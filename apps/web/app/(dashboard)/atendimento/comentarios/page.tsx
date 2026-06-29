import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAccessLevel } from "@/lib/permissions";
import { ComentariosClient } from "./comentarios-client";
import { InboxShell } from "@/components/inbox/inbox-shell";

export default async function ComentariosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const canReply = getAccessLevel(session.user.role, "atendimento") === "full";

  return (
    <InboxShell basePath="/atendimento" active="comentarios" label="Todos os canais">
      <ComentariosClient canReply={canReply} />
    </InboxShell>
  );
}
