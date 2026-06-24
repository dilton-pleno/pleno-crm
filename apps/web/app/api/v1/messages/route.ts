import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendText, sendMedia } from "@/lib/evolution";
import { sendInstagramDirect, sendMessengerMessage } from "@/lib/meta";
import { emitEvent } from "@/lib/websocket";

const schema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().optional().nullable(),
  media_url: z.string().url().optional().nullable(),
  media_type: z.enum(["image", "audio", "document", "sticker", "video"]).optional().nullable(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { conversation_id, content, media_url, media_type } = parsed.data;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversation_id },
    include: { channel: true, contact: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conversa não encontrada" } },
      { status: 404 }
    );
  }

  const channelType = conversation.channel.channelType;
  const to = conversation.channel.channelIdentifier;

  if (!content && !media_url) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "content ou media_url obrigatório" } },
      { status: 422 }
    );
  }

  try {
    if (channelType === "whatsapp") {
      const instanceName = process.env.EVOLUTION_INSTANCE ?? "atendimento";
      if (media_url && media_type) {
        await sendMedia(instanceName, to, media_url, content ?? "", media_type);
      } else if (content) {
        await sendText(instanceName, to, content);
      }
    } else if (channelType === "instagram" || channelType === "messenger") {
      // Envio via Meta suporta texto nesta fase; mídia será adicionada depois.
      if (!content) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Envio de mídia ainda não suportado neste canal" } },
          { status: 422 }
        );
      }
      if (channelType === "instagram") {
        await sendInstagramDirect(to, content);
      } else {
        await sendMessengerMessage(to, content);
      }
    } else {
      return NextResponse.json(
        { error: { code: "UNSUPPORTED_CHANNEL", message: `Canal "${channelType}" não suporta envio` } },
        { status: 422 }
      );
    }
  } catch (err) {
    console.error("[messages] Erro ao enviar mensagem:", err);
    return NextResponse.json(
      { error: { code: "SEND_ERROR", message: "Falha ao enviar mensagem" } },
      { status: 502 }
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation_id,
      direction: "out",
      content: content ?? null,
      mediaUrl: media_url ?? null,
      mediaType: media_type ?? null,
      senderId: session.user.id,
    },
  });

  emitEvent("message:new", { conversationId: conversation_id, messageId: message.id });

  return NextResponse.json(
    {
      data: {
        id: message.id,
        direction: "out",
        content: message.content,
        sent_at: message.sentAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
