import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";

const schema = z.object({
  status: z.enum(["open", "pending", "resolved"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conversa não encontrada" } },
      { status: 404 }
    );
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  emitEvent("conversation:status_changed", {
    conversationId: id,
    status: updated.status,
  });

  // Ao resolver a conversa, move o card do Kanban para o estágio "Resolvido".
  if (updated.status === "resolved") {
    const [card, resolvidoStage] = await Promise.all([
      prisma.pipelineCard.findFirst({ where: { conversationId: id } }),
      prisma.pipelineStage.findFirst({
        where: { name: { equals: "Resolvido", mode: "insensitive" } },
        orderBy: { position: "asc" },
      }),
    ]);
    if (card && resolvidoStage && card.stageId !== resolvidoStage.id) {
      await prisma.pipelineCard.update({
        where: { id: card.id },
        data: { stageId: resolvidoStage.id },
      });
      emitEvent("card:moved", { cardId: card.id, stageId: resolvidoStage.id });
    }
  }

  return NextResponse.json({
    data: { id: updated.id, status: updated.status },
  });
}
