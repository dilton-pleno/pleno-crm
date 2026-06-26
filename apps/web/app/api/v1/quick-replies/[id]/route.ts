import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  content: z.string().min(1).max(2000).optional(),
  shared: z.boolean().optional(),
});

function canManage(reply: { createdBy: string }, userId: string, role: string): boolean {
  return reply.createdBy === userId || role === "ADMIN" || role === "GESTOR";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;
  const { id: userId, role } = guard.session.user;

  const { id } = await params;
  const reply = await prisma.quickReply.findUnique({ where: { id } });
  if (!reply) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Resposta não encontrada" } },
      { status: 404 }
    );
  }
  if (!canManage(reply, userId, role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Sem permissão para editar esta resposta" } },
      { status: 403 }
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const canShare = role === "ADMIN" || role === "GESTOR";
  await prisma.quickReply.update({
    where: { id },
    data: {
      ...(parsed.data.title ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.content ? { content: parsed.data.content.trim() } : {}),
      ...(parsed.data.shared !== undefined && canShare ? { shared: parsed.data.shared } : {}),
    },
  });
  return NextResponse.json({ data: { id } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;
  const { id: userId, role } = guard.session.user;

  const { id } = await params;
  const reply = await prisma.quickReply.findUnique({ where: { id } });
  if (!reply) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Resposta não encontrada" } },
      { status: 404 }
    );
  }
  if (!canManage(reply, userId, role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Sem permissão para excluir esta resposta" } },
      { status: 403 }
    );
  }

  await prisma.quickReply.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
