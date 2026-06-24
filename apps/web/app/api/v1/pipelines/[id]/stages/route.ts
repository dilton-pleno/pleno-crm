import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser hexadecimal (#rrggbb)")
    .optional(),
  position: z.number().int().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Configuração de pipeline é restrita a Admin.
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id: pipelineId } = await params;

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Pipeline não encontrado" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  // Posição padrão: ao final do pipeline.
  const last = await prisma.pipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { position: "desc" },
  });
  const position = parsed.data.position ?? (last ? last.position + 1 : 1);

  const stage = await prisma.pipelineStage.create({
    data: {
      pipelineId,
      name: parsed.data.name,
      color: parsed.data.color ?? "#6366f1",
      position,
    },
  });

  return NextResponse.json({ data: stage }, { status: 201 });
}
