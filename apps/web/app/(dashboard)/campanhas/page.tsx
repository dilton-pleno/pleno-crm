import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { CampanhasClient } from "./campanhas-client";

export default async function CampanhasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "campanhas")) redirect("/atendimento");

  return <CampanhasClient />;
}
