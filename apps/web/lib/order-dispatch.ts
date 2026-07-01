import { prisma } from "@/lib/prisma";
import { runAutomationsFor, type TriggerContext } from "@/lib/automation-engine";
import { getOfficialCloudInboxId } from "@/lib/inbox-routing";

interface DispatchContact {
  id: string;
  phone: string | null;
  secondaryPhone: string | null;
}

// Garante uma conversa de WhatsApp no Canal oficial para o contato, para que o
// disparo (template) tenha lugar no inbox. Retorna a conversationId ou null.
async function ensureOfficialConversation(
  contact: DispatchContact,
  inboxId: string
): Promise<string | null> {
  const phone = (contact.phone || contact.secondaryPhone || "").replace(/\D/g, "");
  if (!phone) return null;

  let channel = await prisma.contactChannel.findUnique({
    where: { channelType_channelIdentifier: { channelType: "whatsapp", channelIdentifier: phone } },
  });
  if (!channel) {
    channel = await prisma.contactChannel.create({
      data: { contactId: contact.id, channelType: "whatsapp", channelIdentifier: phone, inboxId },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: { channelId: channel.id, status: { not: "resolved" } },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { contactId: contact.id, channelId: channel.id, status: "open", inboxName: "WhatsApp", inboxId },
    });
  }
  return conversation.id;
}

// Pré-condições comuns aos disparos ativos: existir automação ativa para o
// gatilho e um Canal oficial (cloud) configurado. Retorna o inboxId oficial ou null.
async function dispatchInboxFor(trigger: TriggerContext["trigger"]): Promise<string | null> {
  const active = await prisma.automation.count({ where: { active: true, triggerType: trigger } });
  if (active === 0) return null;
  return getOfficialCloudInboxId();
}

/**
 * Disparo ativo de atualização de status de pedido (gatilho `order_status`)
 * pelo número OFICIAL. Só age com automação ativa + Canal oficial + contato com telefone.
 */
export async function runOrderStatusDispatch(input: {
  orderExternalId: string;
  status: string;
  storeIntegrationId: string;
}): Promise<void> {
  try {
    const inboxId = await dispatchInboxFor("order_status");
    if (!inboxId) return;

    const order = await prisma.order.findUnique({
      where: { storeIntegrationId_externalId: { storeIntegrationId: input.storeIntegrationId, externalId: input.orderExternalId } },
      select: { contact: { select: { id: true, phone: true, secondaryPhone: true } } },
    });
    if (!order?.contact) return;

    const conversationId = await ensureOfficialConversation(order.contact, inboxId);
    if (!conversationId) return;

    await runAutomationsFor({
      trigger: "order_status",
      conversationId,
      contactId: order.contact.id,
      inboxId,
      channelType: "whatsapp",
      orderStatus: input.status,
    });
  } catch (err) {
    console.error("[order-dispatch] erro (order_status):", err);
  }
}

/**
 * Disparo ativo por Nº de compras (gatilho `purchase_count`): ao registrar um
 * pedido, conta o total de pedidos do contato e dispara — o engine compara com a
 * meta configurada (ex.: 3 compras → cupom). Pelo número OFICIAL.
 */
export async function runPurchaseCountDispatch(input: {
  orderExternalId: string;
  storeIntegrationId: string;
}): Promise<void> {
  try {
    const inboxId = await dispatchInboxFor("purchase_count");
    if (!inboxId) return;

    const order = await prisma.order.findUnique({
      where: { storeIntegrationId_externalId: { storeIntegrationId: input.storeIntegrationId, externalId: input.orderExternalId } },
      select: { contactId: true, contact: { select: { id: true, phone: true, secondaryPhone: true } } },
    });
    if (!order?.contact) return;

    const purchaseCount = await prisma.order.count({ where: { contactId: order.contactId } });

    const conversationId = await ensureOfficialConversation(order.contact, inboxId);
    if (!conversationId) return;

    await runAutomationsFor({
      trigger: "purchase_count",
      conversationId,
      contactId: order.contact.id,
      inboxId,
      channelType: "whatsapp",
      purchaseCount,
    });
  } catch (err) {
    console.error("[order-dispatch] erro (purchase_count):", err);
  }
}
