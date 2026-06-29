import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { requireContactAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";

// Exclui uma nota interna (autor ou ADMIN/GESTOR).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;
  const { id: userId, role } = guard.session.user;

  const { id: contactId, noteId } = await params;
  const access = await requireContactAccess(guard.session, contactId);
  if (!access.ok) return access.response;

  const note = await prisma.contactNote.findUnique({ where: { id: noteId } });
  if (!note) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Nota não encontrada" } },
      { status: 404 }
    );
  }

  const canDelete = note.authorId === userId || role === "ADMIN" || role === "GESTOR";
  if (!canDelete) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Sem permissão para excluir esta nota" } },
      { status: 403 }
    );
  }

  await prisma.contactNote.delete({ where: { id: noteId } });
  return NextResponse.json({ data: { id: noteId } });
}
