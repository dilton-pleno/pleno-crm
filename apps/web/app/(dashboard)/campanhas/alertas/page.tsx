import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { AlertasClient } from "./alertas-client";

export default async function AlertasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "campanhas")) redirect("/atendimento");

  // Só Admin cria/edita; Gestor visualiza.
  return <AlertasClient canManage={role === "ADMIN"} />;
}
