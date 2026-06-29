import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAccessLevel } from "@/lib/permissions";
import { ComentariosClient } from "../../../comentarios/comentarios-client";
import { InboxShell } from "@/components/inbox/inbox-shell";

export default async function CanalComentariosPage({
  params,
}: {
  params: Promise<{ inboxId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { inboxId } = await params;
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { id: true, name: true },
  });
  if (!inbox) notFound();

  const canReply = getAccessLevel(session.user.role, "atendimento") === "full";

  return (
    <InboxShell basePath={`/atendimento/canais/${inbox.id}`} active="comentarios" label={inbox.name}>
      <ComentariosClient canReply={canReply} inboxId={inbox.id} />
    </InboxShell>
  );
}
