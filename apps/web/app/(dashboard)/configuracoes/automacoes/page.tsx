import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@pleno-crm/types";
import { AutomacoesClient, type AutomationDetail, type Option } from "./automacoes-client";

export default async function AutomacoesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "automacoes")) redirect("/atendimento");
  const isAdmin = role === "ADMIN";

  const [automations, inboxes, agents, tags, pipelines] = await Promise.all([
    prisma.automation.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        actions: { orderBy: { position: "asc" } },
        _count: { select: { runs: true } },
        runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
      },
    }),
    prisma.inbox.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.tag.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.pipeline.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { name: true, stages: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
    }),
  ]);

  // Estágios achatados ("Pipeline › Estágio") para a ação Mover no Kanban.
  const stages: Option[] = pipelines.flatMap((p) =>
    p.stages.map((s) => ({ id: s.id, name: `${p.name} › ${s.name}` }))
  );

  const initial: AutomationDetail[] = automations.map((a) => {
    const last = a.runs[0];
    return {
      id: a.id,
      name: a.name,
      active: a.active,
      trigger_type: a.triggerType,
      trigger_config: (a.triggerConfig ?? {}) as Record<string, unknown>,
      actions: a.actions.map((ac) => ({
        action_type: ac.actionType,
        action_config: (ac.actionConfig ?? {}) as Record<string, unknown>,
      })),
      run_count: a._count.runs,
      last_run: last ? { status: last.status, created_at: last.createdAt.toISOString() } : null,
    };
  });

  return (
    <AutomacoesClient
      initialAutomations={initial}
      inboxes={inboxes.map((i) => ({ id: i.id, name: i.name }) as Option)}
      agents={agents.map((a) => ({ id: a.id, name: a.name }) as Option)}
      tags={tags.map((t) => t.name)}
      stages={stages}
      isAdmin={isAdmin}
    />
  );
}
