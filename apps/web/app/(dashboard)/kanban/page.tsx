import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KanbanBoard } from "./kanban-board";

export default async function KanbanPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [agents, pipelines] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.pipeline.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
  ]);

  const initialPipelineId = pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? "";

  return (
    <KanbanBoard
      pipelines={pipelines.map((p) => ({ id: p.id, name: p.name, is_default: p.isDefault }))}
      initialPipelineId={initialPipelineId}
      agents={agents}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
