import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, getUserProfile } from "@/lib/meta";
import { ingestInboundMessage } from "@/lib/inbound-message";
import { upsertPostComment } from "@/lib/post-comment";
import { linkInstagramHandle } from "@/lib/instagram-link";

// ============================================================
// Tipos do payload da Meta (Instagram Direct / Messenger)
// ============================================================

interface MetaWebhookBody {
  object: string; // "instagram" | "page"
  entry: MetaEntry[];
}

interface MetaEntry {
  id: string;
  time: number;
  messaging?: MetaMessaging[];
  changes?: MetaChange[];
}

interface MetaChange {
  field: string; // "comments" | "mentions" | ...
  value: MetaCommentValue;
}

// Payload de um comentário em post do Instagram (field "comments").
interface MetaCommentValue {
  id?: string; // id do comentário
  text?: string;
  parent_id?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
}

interface MetaMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: { type: string; payload?: { url?: string } }[];
    reply_to?: { story?: { id: string; url?: string } };
  };
}

type MetaMediaType = "image" | "audio" | "document" | "sticker" | "video";

function mapAttachmentType(type: string): MetaMediaType | null {
  switch (type) {
    case "image":
      return "image";
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "file":
      return "document";
    default:
      return null;
  }
}

async function handleMessaging(object: string, event: MetaMessaging): Promise<void> {
  const message = event.message;
  if (!message) return;
  // Ignora echoes (mensagens enviadas pela própria página).
  if (message.is_echo) return;

  const channelType = object === "instagram" ? "instagram" : "messenger";
  const inboxName = object === "instagram" ? "Instagram" : "Messenger";
  const senderId = event.sender.id;

  const attachment = message.attachments?.[0];
  const mediaType = attachment ? mapAttachmentType(attachment.type) : null;
  const mediaUrl = attachment?.payload?.url ?? null;

  // Resposta a Story: a Meta entrega como mensagem direta. Sem campo de
  // metadata em Message, marcamos o contexto como prefixo no conteúdo.
  let content = message.text ?? null;
  if (message.reply_to?.story) {
    const base = content ?? "";
    content = `↩️ Resposta ao Story: ${base}`.trim();
  }

  const profile = await getUserProfile(senderId);

  await ingestInboundMessage({
    channelType,
    channelIdentifier: senderId,
    contactName: profile?.name ?? profile?.username ?? senderId,
    contactAvatarUrl: profile?.profile_pic ?? null,
    externalId: message.mid,
    content,
    mediaUrl,
    mediaType,
    sentAt: new Date(event.timestamp),
    inboxName,
  });

  // Instagram: grava o @ no contato e unifica automaticamente com quem já
  // tiver esse @ (ex.: contato de WhatsApp), cruzando Direct + WhatsApp.
  if (channelType === "instagram" && profile?.username) {
    await linkInstagramHandle(senderId, profile.username);
  }
}

async function handleCommentChange(value: MetaCommentValue): Promise<void> {
  const commentId = value.id;
  const postId = value.media?.id;
  // Sem id de comentário ou post não há como registrar/responder depois.
  if (!commentId || !postId) return;

  await upsertPostComment({
    commentId,
    postId,
    authorId: value.from?.id ?? "",
    authorName: value.from?.username ?? "Desconhecido",
    content: value.text ?? "",
  });
}

// ============================================================
// GET: verificação do webhook (challenge)
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
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
  // Corpo cru é necessário para validar a assinatura HMAC.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Assinatura inválida" } },
      { status: 401 }
    );
  }

  const payload = JSON.parse(rawBody) as MetaWebhookBody;

  if (process.env.WEBHOOK_DEBUG === "true") {
    console.log("[webhook/meta] Payload recebido:", rawBody);
  }

  // Responde 200 na hora; processa de forma assíncrona.
  setImmediate(async () => {
    try {
      for (const entry of payload.entry ?? []) {
        for (const event of entry.messaging ?? []) {
          await handleMessaging(payload.object, event);
        }
        for (const change of entry.changes ?? []) {
          if (change.field === "comments") {
            await handleCommentChange(change.value);
          }
          // "mentions" e outros campos: reservados para evoluções futuras.
        }
      }
    } catch (err) {
      console.error("[webhook/meta] Erro ao processar evento:", err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
