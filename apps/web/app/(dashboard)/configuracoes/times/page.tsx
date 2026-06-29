import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TimesClient, type TeamDetail, type Option, type UserOption } from "./times-client";

export default async function TimesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const [teams, users, inboxes, pipelines] = await Promise.all([
    prisma.team.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        inboxes: { select: { inboxId: true } },
        pipelines: { select: { pipelineId: true } },
      },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } }),
    prisma.inbox.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.pipeline.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const initialTeams: TeamDetail[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    members: t.members.map((m) => ({
      user_id: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.user.role,
      is_manager: m.isManager,
    })),
    inbox_ids: t.inboxes.map((i) => i.inboxId),
    pipeline_ids: t.pipelines.map((p) => p.pipelineId),
  }));

  const userOptions: UserOption[] = users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
  const inboxOptions: Option[] = inboxes.map((i) => ({ id: i.id, name: i.name }));
  const pipelineOptions: Option[] = pipelines.map((p) => ({ id: p.id, name: p.name }));

  return (
    <TimesClient
      initialTeams={initialTeams}
      users={userOptions}
      inboxes={inboxOptions}
      pipelines={pipelineOptions}
    />
  );
}
