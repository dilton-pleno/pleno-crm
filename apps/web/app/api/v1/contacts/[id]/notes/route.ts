import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { requireContactAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";

// Lista as notas internas do contato (mais recentes primeiro).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const access = await requireContactAccess(guard.session, id);
  if (!access.ok) return access.response;

  const notes = await prisma.contactNote.findMany({
    where: { contactId: id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    data: notes.map((n) => ({
      id: n.id,
      content: n.content,
      created_at: n.createdAt.toISOString(),
      author: { id: n.author.id, name: n.author.name },
      owned: n.author.id === guard.session.user.id,
    })),
  });
}

const createSchema = z.object({ content: z.string().min(1).max(2000) });

// Cria uma nota interna (qualquer usuário de atendimento).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const access = await requireContactAccess(guard.session, id);
  if (!access.ok) return access.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const note = await prisma.contactNote.create({
    data: { contactId: id, authorId: guard.session.user.id, content: parsed.data.content.trim() },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    data: {
      id: note.id,
      content: note.content,
      created_at: note.createdAt.toISOString(),
      author: { id: note.author.id, name: note.author.name },
      owned: true,
    },
  });
}
