import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InboxClient } from "./inbox-client";

export default async function AtendimentoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Agentes para o seletor de atribuição (ADMIN/GESTOR atribuem a qualquer um).
  const agents = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <InboxClient
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
      agents={agents}
    />
  );
}
