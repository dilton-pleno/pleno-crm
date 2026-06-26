import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KanbanBoard } from "./kanban-board";

export default async function KanbanPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const agents = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <KanbanBoard
      pipelineId="default-pipeline"
      agents={agents}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}
