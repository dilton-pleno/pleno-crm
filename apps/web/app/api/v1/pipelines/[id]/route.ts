import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  is_default: z.literal(true).optional(),
});

// Renomeia e/ou define como padrão (ADMIN/GESTOR).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const pipeline = await prisma.pipeline.findUnique({ where: { id } });
  if (!pipeline) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Pipeline não encontrado" } },
      { status: 404 }
    );
  }

  const { name, is_default } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (is_default) {
      // Só um pipeline padrão por vez.
      await tx.pipeline.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    await tx.pipeline.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(is_default ? { isDefault: true } : {}),
      },
    });
  });

  return NextResponse.json({ data: { id } });
}

// Exclui um pipeline (ADMIN/GESTOR). Bloqueia se for o padrão, o único ou tiver cards.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const pipeline = await prisma.pipeline.findUnique({
    where: { id },
    include: { stages: { select: { _count: { select: { cards: true } } } } },
  });
  if (!pipeline) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Pipeline não encontrado" } },
      { status: 404 }
    );
  }
  if (pipeline.isDefault) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Não é possível excluir o pipeline padrão" } },
      { status: 400 }
    );
  }
  const total = await prisma.pipeline.count();
  if (total <= 1) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Deve existir pelo menos um pipeline" } },
      { status: 400 }
    );
  }
  const cardCount = pipeline.stages.reduce((acc, s) => acc + s._count.cards, 0);
  if (cardCount > 0) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Mova ou remova os cards antes de excluir o pipeline" } },
      { status: 400 }
    );
  }

  // Estágios são removidos em cascata (Pipeline → stages onDelete: Cascade).
  await prisma.pipeline.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
