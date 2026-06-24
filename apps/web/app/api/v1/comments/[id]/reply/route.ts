import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { replyToComment, sendPrivateReply } from "@/lib/meta";

const schema = z.object({
  message: z.string().min(1),
  // "public": resposta no próprio comentário; "direct": abre um Direct com o autor.
  mode: z.enum(["public", "direct"]).optional().default("public"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;

  const { id: commentId } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { message, mode } = parsed.data;

  try {
    if (mode === "direct") {
      await sendPrivateReply(commentId, message);
    } else {
      await replyToComment(commentId, message);
    }
  } catch (err) {
    console.error("[comments/reply] Erro ao responder comentário:", err);
    return NextResponse.json(
      { error: { code: "SEND_ERROR", message: "Falha ao enviar resposta" } },
      { status: 502 }
    );
  }

  const repliedAt = new Date();
  // O comentário já foi registrado ao listar; marca como respondido.
  await prisma.postComment.updateMany({
    where: { commentId },
    data: { repliedAt, replyContent: message },
  });

  return NextResponse.json(
    {
      data: {
        comment_id: commentId,
        reply: message,
        replied_at: repliedAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
