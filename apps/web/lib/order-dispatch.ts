import { prisma } from "@/lib/prisma";
import { runAutomationsFor } from "@/lib/automation-engine";
import { getOfficialCloudInboxId } from "@/lib/inbox-routing";

// Disparo ativo de atualização de status de pedido (gatilho `order_status`) pelo
// número OFICIAL (Canal provider "cloud"). Só age se: (1) existir automação ativa
// para o gatilho, (2) houver um Canal oficial configurado, e (3) o pedido tiver
// contato com telefone. Garante uma conversa de WhatsApp no Canal oficial para o
// disparo ter lugar no inbox; o envio real (template) é feito pelo engine.
export async function runOrderStatusDispatch(input: {
  orderExternalId: string;
  status: string;
}): Promise<void> {
  try {
    const active = await prisma.automation.count({
      where: { active: true, triggerType: "order_status" },
    });
    if (active === 0) return;

    const inboxId = await getOfficialCloudInboxId();
    if (!inboxId) return; // nenhum número oficial configurado

    const order = await prisma.order.findUnique({
      where: { externalId: input.orderExternalId },
      select: { contact: { select: { id: true, name: true, phone: true, secondaryPhone: true } } },
    });
    const contact = order?.contact;
    const phoneRaw = contact?.phone || contact?.secondaryPhone || "";
    const phone = phoneRaw.replace(/\D/g, "");
    if (!contact || !phone) return;

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

    await runAutomationsFor({
      trigger: "order_status",
      conversationId: conversation.id,
      contactId: contact.id,
      inboxId,
      channelType: "whatsapp",
      orderStatus: input.status,
    });
  } catch (err) {
    console.error("[order-dispatch] erro:", err);
  }
}
