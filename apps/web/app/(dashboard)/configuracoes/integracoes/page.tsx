import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { IntegracoesClient } from "./integracoes-client";

export default async function IntegracoesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "integracoes")) redirect("/atendimento");

  // Acesso "full" (Admin/Gestor) libera reconexão direta e aprovação.
  const canManage = role === "ADMIN" || role === "GESTOR";

  return (
    <IntegracoesClient
      currentUserId={session.user.id}
      canManage={canManage}
    />
  );
}
