import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visibleInboxIds } from "@/lib/visibility";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { Role } from "@pleno-crm/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Canais ativos para a Caixa de Entrada, restritos à visibilidade do usuário
  // (null = sem restrição: ADMIN ou usuário sem time).
  const visible = await visibleInboxIds(session.user);
  const inboxes = await prisma.inbox.findMany({
    where: { active: true, ...(visible ? { id: { in: visible } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={session.user.role as Role} inboxes={inboxes} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          userName={session.user.name}
          userRole={session.user.role as Role}
        />
        <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
      </div>
    </div>
  );
}
