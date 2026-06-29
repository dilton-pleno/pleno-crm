import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const automationInclude = {
  actions: { orderBy: { position: "asc" } },
  _count: { select: { runs: true } },
  runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
} as const;

type AutomationRow = Prisma.AutomationGetPayload<{ include: typeof automationInclude }>;

function serialize(a: AutomationRow) {
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

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("automacoes");
  if (!guard.ok) return guard.response;

  const automations = await prisma.automation.findMany({
    orderBy: { createdAt: "asc" },
    include: automationInclude,
  });
  return NextResponse.json({ data: automations.map(serialize) });
}

const actionSchema = z.object({
  position: z.number().int(),
  action_type: z.enum(["send_message", "add_tag", "assign_agent", "move_kanban", "webhook", "wait"]),
  action_config: z.record(z.unknown()).default({}),
});

const createSchema = z.object({
  name: z.string().min(1).max(80),
  trigger_type: z.enum(["new_message", "keyword", "new_contact", "conversation_opened", "abandoned_cart", "schedule"]),
  trigger_config: z.record(z.unknown()).default({}),
  active: z.boolean().optional().default(false),
  actions: z.array(actionSchema).default([]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Criar/editar automação é exclusivo do ADMIN (Gestor tem nível "request").
  const guard = await requireAccess("automacoes", "full");
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }
  const d = parsed.data;

  const automation = await prisma.automation.create({
    data: {
      name: d.name.trim(),
      triggerType: d.trigger_type,
      triggerConfig: d.trigger_config as Prisma.InputJsonValue,
      active: d.active,
      createdBy: guard.session.user.id,
      actions: {
        create: d.actions.map((a) => ({
          position: a.position,
          actionType: a.action_type,
          actionConfig: a.action_config as Prisma.InputJsonValue,
        })),
      },
    },
    include: automationInclude,
  });

  return NextResponse.json({ data: serialize(automation) }, { status: 201 });
}
