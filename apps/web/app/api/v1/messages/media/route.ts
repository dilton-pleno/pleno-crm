import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { requireConversationAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";
import { sendMediaBase64, sendWhatsAppAudio } from "@/lib/evolution";
import { resolveWhatsappInstance } from "@/lib/inbox-routing";
import { emitEvent } from "@/lib/websocket";

const MAX_DOCUMENT = 50 * 1024 * 1024; // 50 MB
const MAX_OTHER = 16 * 1024 * 1024; // 16 MB (imagem/vídeo/áudio)

type UploadMediaType = "image" | "video" | "audio" | "document";

function mediaTypeFromMime(mime: string): UploadMediaType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  const form = await request.formData();
  const conversationId = form.get("conversation_id");
  const caption = (form.get("caption") as string | null)?.trim() || null;
  const file = form.get("file");

  if (typeof conversationId !== "string" || !(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "conversation_id e file são obrigatórios" } },
      { status: 422 }
    );
  }

  const access = await requireConversationAccess(session, conversationId);
  if (!access.ok) return access.response;

  const mediaType = mediaTypeFromMime(file.type || "");
  const limit = mediaType === "document" ? MAX_DOCUMENT : MAX_OTHER;
  if (file.size > limit) {
    return NextResponse.json(
      { error: { code: "FILE_TOO_LARGE", message: `Arquivo excede o limite de ${Math.round(limit / 1024 / 1024)} MB` } },
      { status: 413 }
    );
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { channel: true },
  });
  if (!conversation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conversa não encontrada" } },
      { status: 404 }
    );
  }
  if (conversation.channel.channelType !== "whatsapp") {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_CHANNEL", message: "Envio de arquivo disponível apenas no WhatsApp" } },
      { status: 422 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimetype = file.type || "application/octet-stream";
  const fileName = file.name || "arquivo";
  const to = conversation.channel.channelIdentifier;
  const instanceName = await resolveWhatsappInstance(conversation.inboxId);

  let externalId: string | null = null;
  try {
    if (mediaType === "audio") {
      const result = await sendWhatsAppAudio(instanceName, to, base64);
      externalId = result.key?.id ?? null;
    } else {
      const result = await sendMediaBase64(instanceName, to, {
        base64,
        mimetype,
        fileName,
        caption: caption ?? "",
        mediatype: mediaType,
      });
      externalId = result.key?.id ?? null;
    }
  } catch (err) {
    console.error("[messages/media] Erro ao enviar arquivo:", err);
    return NextResponse.json(
      { error: { code: "SEND_ERROR", message: "Falha ao enviar arquivo" } },
      { status: 502 }
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "out",
      content: caption,
      mediaType,
      mediaData: new Uint8Array(buffer),
      mediaMimeType: mimetype,
      mediaFileName: fileName,
      senderId: session.user.id,
      externalId,
    },
  });

  emitEvent("message:new", { conversationId, messageId: message.id });

  return NextResponse.json(
    { data: { id: message.id, media_type: mediaType, sent_at: message.sentAt.toISOString() } },
    { status: 201 }
  );
}
