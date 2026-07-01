import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { ContasClient } from "./contas-client";

export default async function ContasAnuncioPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "campanhas")) redirect("/atendimento");

  // Só Admin reatribui contas a lojas; Gestor visualiza.
  return <ContasClient canManage={role === "ADMIN"} />;
}
