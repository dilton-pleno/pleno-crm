import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// Lista respostas rápidas visíveis ao usuário (próprias + compartilhadas).
export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;
  const userId = guard.session.user.id;

  const replies = await prisma.quickReply.findMany({
    where: { OR: [{ createdBy: userId }, { shared: true }] },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({
    data: replies.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      shared: r.shared,
      owned: r.createdBy === userId,
    })),
  });
}

const createSchema = z.object({
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(2000),
  shared: z.boolean().optional(),
});

// Cria uma resposta rápida. Compartilhar só ADMIN/GESTOR.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;
  const { id: userId, role } = guard.session.user;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const canShare = role === "ADMIN" || role === "GESTOR";
  const reply = await prisma.quickReply.create({
    data: {
      title: parsed.data.title.trim(),
      content: parsed.data.content.trim(),
      shared: canShare ? parsed.data.shared ?? false : false,
      createdBy: userId,
    },
  });

  return NextResponse.json({
    data: { id: reply.id, title: reply.title, content: reply.content, shared: reply.shared, owned: true },
  });
}
