import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendOutboundMessage } from "@/lib/outbound";

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

  if (!content && !media_url) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "content ou media_url obrigatório" } },
      { status: 422 }
    );
  }

  let message;
  try {
    message = await sendOutboundMessage(conversation, {
      content,
      mediaUrl: media_url,
      mediaType: media_type,
      senderId: session.user.id,
    });
  } catch (err) {
    console.error("[messages] Erro ao enviar mensagem:", err);
    return NextResponse.json(
      { error: { code: "SEND_ERROR", message: "Falha ao enviar mensagem" } },
      { status: 502 }
    );
  }

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
