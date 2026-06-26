import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { ProdutosClient } from "./produtos-client";

export default async function ProdutosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "ecommerce")) redirect("/atendimento");

  return <ProdutosClient />;
}
