import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { inboxHasMetaToken } from "@/lib/inbox-config";
import { inboxHasCloudToken, inboxCloudWabaId } from "@/lib/whatsapp-channel-config";
import { DEFAULT_INBOX_ID } from "@/lib/inbox-routing";
import { CanaisClient, type CanalItem } from "./canais-client";

export default async function CanaisPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const inboxes = await prisma.inbox.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { conversations: true, channels: true } } },
  });

  const initial: CanalItem[] = inboxes.map((i) => ({
    id: i.id,
    name: i.name,
    active: i.active,
    whatsapp_provider: i.whatsappProvider === "cloud" ? "cloud" : "evolution",
    whatsapp_instance: i.whatsappInstance,
    whatsapp_phone_number_id: i.whatsappPhoneNumberId,
    whatsapp_waba_id: inboxCloudWabaId(i.whatsappConfig),
    has_cloud_token: inboxHasCloudToken(i.whatsappConfig),
    meta_page_id: i.metaPageId,
    meta_ig_id: i.metaIgId,
    has_meta_token: inboxHasMetaToken(i.metaConfig),
    is_default: i.id === DEFAULT_INBOX_ID,
    conversation_count: i._count.conversations,
    channel_count: i._count.channels,
  }));

  return <CanaisClient initialCanais={initial} />;
}
