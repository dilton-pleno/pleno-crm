import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";

const schema = z.object({
  user_id: z.string().uuid().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;
  const session = guard.session;

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

  const { user_id } = parsed.data;
  const role = session.user.role;

  // ADMIN e GESTOR podem atribuir a qualquer agente
  // ATENDENTE só pode assumir conversa não atribuída (assignar para si mesmo)
  if (role === "ATENDENTE") {
    if (user_id !== session.user.id) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Atendente só pode assumir conversas para si mesmo" } },
        { status: 403 }
      );
    }
    if (conversation.assignedTo !== null) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Conversa já está atribuída" } },
        { status: 403 }
      );
    }
  }

  const updated = await prisma.conversation.update({
    where: { id },
    data: { assignedTo: user_id },
    include: { agent: { select: { id: true, name: true } } },
  });

  if (user_id) {
    emitEvent("conversation:assigned", {
      conversationId: id,
      assignedTo: { id: updated.agent?.id, name: updated.agent?.name },
    });
  }

  return NextResponse.json({
    data: {
      id: updated.id,
      assigned_to: updated.agent ? { id: updated.agent.id, name: updated.agent.name } : null,
    },
  });
}
