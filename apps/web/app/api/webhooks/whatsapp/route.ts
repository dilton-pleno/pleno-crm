import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestInboundMessage } from "@/lib/inbound-message";
import { getBase64FromMediaMessage } from "@/lib/evolution";
import { handleConnectionUpdate } from "@/lib/whatsapp-connection";

type WhatsAppEvent = "messages.upsert" | "messages.update" | "connection.update";

interface WebhookPayload {
  event: WhatsAppEvent;
  instance: string;
  data: MessageUpsertData | MessageUpdateData | ConnectionUpdateData;
}

interface MessageUpsertData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string };
    documentMessage?: { url?: string; title?: string; fileName?: string; caption?: string };
    stickerMessage?: { url?: string };
    videoMessage?: { caption?: string; url?: string };
  };
  messageTimestamp: number;
  pushName?: string;
}

interface MessageUpdateData {
  key: { remoteJid: string; id: string };
  update: { status?: number };
}

interface ConnectionUpdateData {
  state?: string;
  statusReason?: number;
}

function extractPhone(remoteJid: string): string {
  return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

type MediaType = "image" | "audio" | "document" | "sticker" | "video";

function extractMediaInfo(data: MessageUpsertData): {
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  fileName: string | null;
} {
  const msg = data.message;
  if (!msg) return { content: null, mediaUrl: null, mediaType: null, fileName: null };

  if (msg.conversation) {
    return { content: msg.conversation, mediaUrl: null, mediaType: null, fileName: null };
  }
  if (msg.extendedTextMessage?.text) {
    return { content: msg.extendedTextMessage.text, mediaUrl: null, mediaType: null, fileName: null };
  }
  if (msg.imageMessage) {
    return { content: msg.imageMessage.caption ?? null, mediaUrl: msg.imageMessage.url ?? null, mediaType: "image", fileName: null };
  }
  if (msg.audioMessage) {
    return { content: null, mediaUrl: msg.audioMessage.url ?? null, mediaType: "audio", fileName: null };
  }
  if (msg.documentMessage) {
    const fileName = msg.documentMessage.fileName ?? msg.documentMessage.title ?? null;
    return { content: msg.documentMessage.caption ?? null, mediaUrl: msg.documentMessage.url ?? null, mediaType: "document", fileName };
  }
  if (msg.stickerMessage) {
    return { content: null, mediaUrl: msg.stickerMessage.url ?? null, mediaType: "sticker", fileName: null };
  }
  if (msg.videoMessage) {
    return { content: msg.videoMessage.caption ?? null, mediaUrl: msg.videoMessage.url ?? null, mediaType: "video", fileName: null };
  }
  return { content: null, mediaUrl: null, mediaType: null, fileName: null };
}

async function handleMessageUpsert(data: MessageUpsertData): Promise<void> {
  // Payload defensivo: ignora eventos sem chave/id (ex.: ruído de reconexão).
  if (!data?.key?.id || !data.key.remoteJid) return;

  // fromMe = mensagem enviada pelo próprio número, inclusive respostas feitas
  // direto pelo app do WhatsApp no celular. Ingerimos como "out" para o
  // histórico ficar completo; o eco das mensagens enviadas pelo CRM é
  // deduplicado pelo externalId.
  const direction: "in" | "out" = data.key.fromMe ? "out" : "in";

  const phone = extractPhone(data.key.remoteJid);
  const { content, mediaUrl, mediaType, fileName } = extractMediaInfo(data);

  // Ignora ecos sem conteúdo aproveitável (ex.: mensagens de protocolo).
  if (!content && !mediaType) return;

  // Dedup antecipada: se a mensagem já existe (ex.: eco de envio do próprio
  // CRM), evita baixar mídia e reprocessar à toa.
  const already = await prisma.message.findFirst({
    where: { externalId: data.key.id },
    select: { id: true },
  });
  if (already) return;

  // Mídia: a URL do WhatsApp é criptografada, então baixamos os bytes reais
  // pelo Evolution. Se falhar, a mensagem é salva mesmo assim (sem a mídia),
  // preservando legenda/texto e a notificação em tempo real.
  let mediaData: Uint8Array<ArrayBuffer> | null = null;
  let mediaMimeType: string | null = null;
  let mediaFileName: string | null = fileName;

  if (mediaType) {
    const instanceName = process.env.EVOLUTION_INSTANCE;
    if (instanceName) {
      try {
        const media = await getBase64FromMediaMessage(instanceName, {
          remoteJid: data.key.remoteJid,
          fromMe: data.key.fromMe,
          id: data.key.id,
        });
        if (media) {
          mediaData = media.data;
          mediaMimeType = media.mimeType;
          mediaFileName = mediaFileName ?? media.fileName;
        }
      } catch (err) {
        console.error("[webhook/whatsapp] Falha ao baixar mídia do Evolution:", err);
      }
    }
  }

  // Em fromMe o pushName é o nome do próprio operador, não do contato; nesse
  // caso usamos o telefone como nome ao criar um contato novo.
  const contactName = data.key.fromMe ? phone : data.pushName ?? phone;

  await ingestInboundMessage({
    channelType: "whatsapp",
    channelIdentifier: phone,
    contactName,
    phone,
    externalId: data.key.id,
    direction,
    content,
    mediaUrl,
    mediaType,
    mediaData,
    mediaMimeType,
    mediaFileName,
    sentAt: new Date(data.messageTimestamp * 1000),
    inboxName: "WhatsApp",
  });
}

async function handleMessageUpdate(data: MessageUpdateData): Promise<void> {
  // A Evolution pode mandar messages.update sem `update` (ou sem `key`) quando a
  // instância está instável/reconectando; ignora em vez de quebrar.
  const key = data?.key;
  const update = data?.update;
  if (!update?.status || !key?.id) return;

  // Evolution status: 3 = delivered, 4 = read
  const now = new Date();
  if (update.status === 3) {
    await prisma.message.updateMany({
      where: { externalId: key.id, deliveredAt: null },
      data: { deliveredAt: now },
    });
  } else if (update.status === 4) {
    await prisma.message.updateMany({
      where: { externalId: key.id, readAt: null },
      data: { readAt: now },
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid webhook secret" } },
      { status: 401 }
    );
  }

  // Return 200 immediately to avoid N8N timeout, process async
  const payload = (await request.json()) as WebhookPayload;

  // O payload contem o conteudo das mensagens; loga apenas em modo debug.
  if (process.env.WEBHOOK_DEBUG === "true") {
    console.log("[webhook/whatsapp] Payload recebido:", JSON.stringify(payload));
  }

  setImmediate(async () => {
    try {
      if (payload.event === "messages.upsert") {
        // Algumas versões mandam um array de mensagens.
        const items = Array.isArray(payload.data) ? payload.data : [payload.data];
        for (const item of items) await handleMessageUpsert(item as MessageUpsertData);
      } else if (payload.event === "messages.update") {
        // Pode vir como objeto único ou array de updates.
        const items = Array.isArray(payload.data) ? payload.data : [payload.data];
        for (const item of items) await handleMessageUpdate(item as MessageUpdateData);
      } else if (payload.event === "connection.update") {
        const data = payload.data as ConnectionUpdateData;
        await handleConnectionUpdate(payload.instance, data?.state, data?.statusReason);
      }
    } catch (err) {
      // No Node, passar o Error como argumento imprime mensagem + stack.
      console.error("[webhook/whatsapp] Erro ao processar evento:", err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
