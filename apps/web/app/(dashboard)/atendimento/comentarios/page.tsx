import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAccessLevel } from "@/lib/permissions";
import { ComentariosClient } from "./comentarios-client";

export default async function ComentariosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canReply = getAccessLevel(session.user.role, "atendimento") === "full";

  return <ComentariosClient canReply={canReply} />;
}
