import { NextRequest, NextResponse } from "next/server";
import type { MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/meta";
import { ingestInboundMessage } from "@/lib/inbound-message";
import { resolveInboxByWhatsappPhoneNumberId } from "@/lib/inbox-routing";
import { getWhatsappChannel, verifyCloudToken } from "@/lib/whatsapp-channel-config";
import { downloadMediaById } from "@/lib/whatsapp-cloud";

// ============================================================
// Webhook da WhatsApp Cloud API (API OFICIAL). A Meta entrega direto aqui
// (não passa pelo N8N). Assinatura HMAC usa o app secret do mesmo app Meta,
// então reaproveitamos verifyWebhookSignature de lib/meta.ts.
// ============================================================

interface CloudWebhookBody {
  object: string; // "whatsapp_business_account"
  entry?: CloudEntry[];
}

interface CloudEntry {
  id: string;
  changes?: CloudChange[];
}

interface CloudChange {
  field: string; // "messages"
  value: CloudValue;
}

interface CloudValue {
  messaging_product?: string; // "whatsapp"
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: CloudMessage[];
  statuses?: CloudStatus[];
}

interface CloudMediaObject {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
}

interface CloudMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: CloudMediaObject;
  audio?: CloudMediaObject;
  video?: CloudMediaObject;
  document?: CloudMediaObject;
  sticker?: CloudMediaObject;
  button?: { text?: string; payload?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
}

interface CloudStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
}

const MEDIA_FIELDS: MediaType[] = ["image", "audio", "video", "document", "sticker"];

// Extrai conteúdo textual e o descritor de mídia de uma mensagem recebida.
function parseMessage(msg: CloudMessage): {
  content: string | null;
  mediaType: MediaType | null;
  media: CloudMediaObject | null;
} {
  if (msg.type === "text") {
    return { content: msg.text?.body ?? null, mediaType: null, media: null };
  }
  // Respostas a botões/listas (menus e templates interativos).
  if (msg.type === "button") {
    return { content: msg.button?.text ?? null, mediaType: null, media: null };
  }
  if (msg.type === "interactive") {
    const title = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? null;
    return { content: title, mediaType: null, media: null };
  }
  // Mídia: o tipo da mensagem casa 1:1 com o nosso enum.
  if (MEDIA_FIELDS.includes(msg.type as MediaType)) {
    const mediaType = msg.type as MediaType;
    const media = (msg[mediaType as keyof CloudMessage] as CloudMediaObject | undefined) ?? null;
    return { content: media?.caption ?? null, mediaType, media };
  }
  // location/contacts/reaction/system e afins: sem conteúdo aproveitável agora.
  return { content: null, mediaType: null, media: null };
}

async function handleMessage(value: CloudValue, msg: CloudMessage): Promise<void> {
  const phoneNumberId = value.metadata?.phone_number_id;
  const inboxId = await resolveInboxByWhatsappPhoneNumberId(phoneNumberId);

  const { content, mediaType, media } = parseMessage(msg);
  if (!content && !mediaType) return; // nada aproveitável

  const phone = msg.from; // wa_id já é o telefone em formato internacional (dígitos)
  const contact = value.contacts?.find((c) => c.wa_id === msg.from);
  const contactName = contact?.profile?.name ?? phone;

  // Baixa a mídia pelos bytes (media id → url → download), como no Evolution.
  let mediaData: Uint8Array<ArrayBuffer> | null = null;
  let mediaMimeType: string | null = null;
  let mediaFileName: string | null = media?.filename ?? null;

  if (mediaType && media?.id) {
    const ch = await getWhatsappChannel(inboxId);
    if (ch.phoneNumberId && ch.accessToken) {
      const payload = await downloadMediaById(
        { phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken },
        media.id,
        media.filename
      );
      if (payload) {
        mediaData = payload.data;
        mediaMimeType = payload.mimeType;
        mediaFileName = mediaFileName ?? payload.fileName;
      }
    }
  }

  await ingestInboundMessage({
    channelType: "whatsapp",
    channelIdentifier: phone,
    contactName,
    phone,
    externalId: msg.id,
    direction: "in",
    content,
    mediaType,
    mediaData,
    mediaMimeType,
    mediaFileName,
    sentAt: new Date(Number(msg.timestamp) * 1000),
    inboxName: "WhatsApp",
    inboxId,
  });
}

async function handleStatus(status: CloudStatus): Promise<void> {
  const now = new Date();
  if (status.status === "delivered") {
    await prisma.message.updateMany({
      where: { externalId: status.id, deliveredAt: null },
      data: { deliveredAt: now },
    });
  } else if (status.status === "read") {
    await prisma.message.updateMany({
      where: { externalId: status.id, readAt: null },
      data: { readAt: now },
    });
  }
  // "sent"/"failed": sem coluna dedicada; ignorados por ora.
}

// ============================================================
// GET: verificação do webhook (challenge)
// ============================================================
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && (await verifyCloudToken(token))) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json(
    { error: { code: "FORBIDDEN", message: "Verificação inválida" } },
    { status: 403 }
  );
}

// ============================================================
// POST: recebimento de eventos
// ============================================================
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Assinatura inválida" } },
      { status: 401 }
    );
  }

  const payload = JSON.parse(rawBody) as CloudWebhookBody;

  if (process.env.WEBHOOK_DEBUG === "true") {
    console.log("[webhook/whatsapp-cloud] Payload recebido:", rawBody);
  }

  // Responde 200 na hora; processa de forma assíncrona.
  setImmediate(async () => {
    try {
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== "messages") continue;
          const value = change.value;
          for (const msg of value.messages ?? []) await handleMessage(value, msg);
          for (const status of value.statuses ?? []) await handleStatus(status);
        }
      }
    } catch (err) {
      console.error("[webhook/whatsapp-cloud] Erro ao processar evento:", err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
