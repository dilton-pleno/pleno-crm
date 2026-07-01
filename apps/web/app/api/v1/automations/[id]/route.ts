import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const include = {
  actions: { orderBy: { position: "asc" } },
  _count: { select: { runs: true } },
  runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
} as const;

function serialize(a: Prisma.AutomationGetPayload<{ include: typeof include }>) {
  const last = a.runs[0];
  return {
    id: a.id,
    name: a.name,
    active: a.active,
    trigger_type: a.triggerType,
    trigger_config: a.triggerConfig,
    actions: a.actions.map((ac) => ({
      id: ac.id,
      position: ac.position,
      action_type: ac.actionType,
      action_config: ac.actionConfig,
    })),
    run_count: a._count.runs,
    last_run: last ? { status: last.status, created_at: last.createdAt.toISOString() } : null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("automacoes");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const automation = await prisma.automation.findUnique({ where: { id }, include });
  if (!automation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Automação não encontrada" } },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: serialize(automation) });
}

const actionSchema = z.object({
  position: z.number().int(),
  action_type: z.enum(["send_message", "send_template", "add_tag", "assign_agent", "move_kanban", "webhook", "wait"]),
  action_config: z.record(z.unknown()).default({}),
});

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  trigger_type: z.enum(["new_message", "keyword", "new_contact", "conversation_opened", "abandoned_cart", "order_status", "purchase_count", "schedule"]).optional(),
  trigger_config: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
  actions: z.array(actionSchema).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("automacoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await prisma.automation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Automação não encontrada" } },
      { status: 404 }
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.automation.update({
      where: { id },
      data: {
        name: d.name?.trim(),
        triggerType: d.trigger_type,
        triggerConfig: d.trigger_config as Prisma.InputJsonValue | undefined,
        active: d.active,
      },
    });
    // Substitui o conjunto de ações quando enviado.
    if (d.actions) {
      await tx.automationAction.deleteMany({ where: { automationId: id } });
      await tx.automationAction.createMany({
        data: d.actions.map((a) => ({
          automationId: id,
          position: a.position,
          actionType: a.action_type,
          actionConfig: a.action_config as Prisma.InputJsonValue,
        })),
      });
    }
  });

  const updated = await prisma.automation.findUniqueOrThrow({ where: { id }, include });
  return NextResponse.json({ data: serialize(updated) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("automacoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await prisma.automation.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
