import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_INBOX_ID } from "@/lib/inbox-routing";
import { CanaisClient, type CanalItem, type IntegrationOption } from "./canais-client";

export default async function CanaisPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const [inboxes, integrations] = await Promise.all([
    prisma.inbox.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { conversations: true, channels: true } },
        whatsappIntegration: { select: { id: true, name: true, provider: true } },
        metaIntegration: { select: { id: true, name: true } },
      },
    }),
    prisma.integration.findMany({
      orderBy: { createdAt: "asc" },
      include: { inboxWhatsapp: { select: { id: true } }, inboxMeta: { select: { id: true } } },
    }),
  ]);

  const initial: CanalItem[] = inboxes.map((i) => ({
    id: i.id,
    name: i.name,
    active: i.active,
    is_default: i.id === DEFAULT_INBOX_ID,
    whatsapp_integration: i.whatsappIntegration
      ? { id: i.whatsappIntegration.id, name: i.whatsappIntegration.name, provider: i.whatsappIntegration.provider }
      : null,
    meta_integration: i.metaIntegration ? { id: i.metaIntegration.id, name: i.metaIntegration.name } : null,
    conversation_count: i._count.conversations,
    channel_count: i._count.channels,
  }));

  const options: IntegrationOption[] = integrations.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type as "whatsapp" | "meta",
    provider: i.provider,
    assigned_inbox_id: i.inboxWhatsapp?.id ?? i.inboxMeta?.id ?? null,
  }));

  return <CanaisClient initialCanais={initial} integrations={options} />;
}
