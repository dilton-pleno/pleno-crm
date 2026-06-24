import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hexadecimal (#rrggbb)")
      .optional(),
    position: z.number().int().min(1).optional(),
  })
  .refine((d) => d.name !== undefined || d.color !== undefined || d.position !== undefined, {
    message: "Informe ao menos um campo para atualizar",
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const stage = await prisma.pipelineStage.findUnique({ where: { id } });
  if (!stage) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Estágio não encontrado" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const updated = await prisma.pipelineStage.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const stage = await prisma.pipelineStage.findUnique({ where: { id } });
  if (!stage) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Estágio não encontrado" } },
      { status: 404 }
    );
  }

  // Bloqueia remoção de estágio com cards ativos (aviso tratado na UI).
  const cardCount = await prisma.pipelineCard.count({ where: { stageId: id } });
  if (cardCount > 0) {
    return NextResponse.json(
      {
        error: {
          code: "STAGE_NOT_EMPTY",
          message: `Estágio possui ${cardCount} card(s) ativo(s). Mova-os antes de remover.`,
        },
      },
      { status: 409 }
    );
  }

  await prisma.pipelineStage.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
