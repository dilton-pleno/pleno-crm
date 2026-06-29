import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { requireConversationAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";

const schema = z.object({
  stage_id: z.string().min(1),
  // O schema atual não persiste ordem dentro do estágio; aceito para compatibilidade.
  position: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("kanban", "full");
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

  const card = await prisma.pipelineCard.findUnique({ where: { id } });
  if (!card) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Card não encontrado" } },
      { status: 404 }
    );
  }

  // Object-level authz: só move cards de conversas de Canais visíveis.
  const access = await requireConversationAccess(guard.session, card.conversationId);
  if (!access.ok) return access.response;

  const stage = await prisma.pipelineStage.findUnique({ where: { id: parsed.data.stage_id } });
  if (!stage) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Estágio não encontrado" } },
      { status: 404 }
    );
  }

  const updated = await prisma.pipelineCard.update({
    where: { id },
    data: { stageId: stage.id },
  });

  emitEvent("card:moved", { cardId: updated.id, stageId: stage.id });

  return NextResponse.json({
    data: {
      card_id: updated.id,
      stage_id: updated.stageId,
      moved_at: updated.updatedAt.toISOString(),
    },
  });
}
