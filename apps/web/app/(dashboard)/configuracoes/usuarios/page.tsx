import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UsuariosClient } from "./usuarios-client";

export default async function UsuariosPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  return <UsuariosClient currentUserId={session.user.id} />;
}
