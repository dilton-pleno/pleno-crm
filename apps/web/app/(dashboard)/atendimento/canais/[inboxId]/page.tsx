import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InboxClient } from "../../inbox-client";
import { InboxShell } from "@/components/inbox/inbox-shell";

export default async function CanalConversasPage({
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

  const agents = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <InboxShell basePath={`/atendimento/canais/${inbox.id}`} active="conversas" label={inbox.name}>
      <InboxClient
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
        agents={agents}
        inboxId={inbox.id}
      />
    </InboxShell>
  );
}
