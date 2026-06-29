import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canSeeInbox } from "@/lib/visibility";

// Agentes elegíveis para atribuição desta conversa: membros de algum time
// vinculado ao Canal da conversa. Mantém o seletor coerente com a regra de
// atribuição (a API de assign já bloqueia destinatários fora do time).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { inboxId: true },
  });
  if (!conversation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conversa não encontrada" } },
      { status: 404 }
    );
  }

  // Não-ADMIN precisa enxergar o Canal para listar/atribuir.
  if (guard.session.user.role !== "ADMIN") {
    if (!conversation.inboxId || !(await canSeeInbox(guard.session.user, conversation.inboxId))) {
      return NextResponse.json({ data: [] });
    }
  }

  if (!conversation.inboxId) return NextResponse.json({ data: [] });

  const users = await prisma.user.findMany({
    where: {
      active: true,
      teamMemberships: { some: { team: { inboxes: { some: { inboxId: conversation.inboxId } } } } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: users });
}
