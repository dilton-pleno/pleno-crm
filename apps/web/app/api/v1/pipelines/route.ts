import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess, requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// Estágios padrão de um pipeline novo.
const DEFAULT_STAGES = [
  { name: "Novo", color: "#3b82f6", position: 0 },
  { name: "Em atendimento", color: "#f59e0b", position: 1 },
  { name: "Aguardando cliente", color: "#f97316", position: 2 },
  { name: "Resolvido", color: "#22c55e", position: 3 },
];

// Lista os pipelines (qualquer um com acesso ao Kanban).
export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("kanban");
  if (!guard.ok) return guard.response;

  const pipelines = await prisma.pipeline.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      stages: {
        orderBy: { position: "asc" },
        select: { id: true, _count: { select: { cards: true } } },
      },
    },
  });

  return NextResponse.json({
    data: pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      is_default: p.isDefault,
      stage_count: p.stages.length,
      card_count: p.stages.reduce((acc, s) => acc + s._count.cards, 0),
      first_stage_id: p.stages[0]?.id ?? null,
    })),
  });
}

const createSchema = z.object({ name: z.string().min(1).max(60) });

// Cria um pipeline já com estágios padrão (ADMIN/GESTOR).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const pipeline = await prisma.pipeline.create({
    data: {
      name: parsed.data.name.trim(),
      createdBy: guard.session.user.id,
      stages: { create: DEFAULT_STAGES },
    },
  });

  return NextResponse.json({
    data: { id: pipeline.id, name: pipeline.name, is_default: pipeline.isDefault },
  });
}
