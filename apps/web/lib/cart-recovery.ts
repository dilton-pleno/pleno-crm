import { prisma } from "@/lib/prisma";
import { runAutomationsFor } from "@/lib/automation-engine";
import { getDefaultInboxId } from "@/lib/inbox-routing";

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Dispara as automações de recuperação de carrinho abandonado (gatilho
 * `abandoned_cart`). Só age se houver alguma automação ativa para o gatilho —
 * evita criar conversas à toa. Garante um contato/canal/conversa de WhatsApp
 * para o telefone do carrinho, para que a mensagem de recuperação tenha lugar
 * no inbox e seja enviada pelo engine (ação send_message).
 */
export async function runAbandonedCartRecovery(input: {
  phone?: string | null;
  name?: string | null;
}): Promise<void> {
  try {
    const phone = input.phone ? normalizePhone(input.phone) : "";
    if (!phone) return;

    const active = await prisma.automation.count({
      where: { active: true, triggerType: "abandoned_cart" },
    });
    if (active === 0) return;

    const inboxId = await getDefaultInboxId();

    let channel = await prisma.contactChannel.findUnique({
      where: { channelType_channelIdentifier: { channelType: "whatsapp", channelIdentifier: phone } },
    });
    let contactId: string;
    if (channel) {
      contactId = channel.contactId;
    } else {
      const contact = await prisma.contact.create({
        data: { name: input.name?.trim() || phone, phone },
      });
      channel = await prisma.contactChannel.create({
        data: { contactId: contact.id, channelType: "whatsapp", channelIdentifier: phone, inboxId },
      });
      contactId = contact.id;
    }

    let conversation = await prisma.conversation.findFirst({
      where: { channelId: channel.id, status: { not: "resolved" } },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { contactId, channelId: channel.id, status: "open", inboxName: "WhatsApp", inboxId },
      });
    }

    await runAutomationsFor({
      trigger: "abandoned_cart",
      conversationId: conversation.id,
      contactId,
      inboxId,
      channelType: "whatsapp",
      messageContent: null,
    });
  } catch (err) {
    console.error("[cart-recovery] erro:", err);
  }
}
