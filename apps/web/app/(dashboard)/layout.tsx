import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
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

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/atendimento";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={session.user.role as Role} currentPath={pathname} />
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
