import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { VisaoGeralClient } from "./visao-geral-client";

export default async function VisaoGeralPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "visao_geral")) redirect("/atendimento");

  return <VisaoGeralClient userName={session.user.name} />;
}
