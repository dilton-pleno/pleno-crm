import type { MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendText, sendMedia } from "@/lib/evolution";
import * as cloud from "@/lib/whatsapp-cloud";
import { getWhatsappChannel } from "@/lib/whatsapp-channel-config";
import { sendInstagramDirect, sendMessengerMessage } from "@/lib/meta";
import { resolveWhatsappInstance } from "@/lib/inbox-routing";
import { emitEvent } from "@/lib/websocket";

// Conversa mínima necessária para enviar (id, Canal e identificadores).
export interface OutboundConversation {
  id: string;
  inboxId: string | null;
  channel: { channelType: string; channelIdentifier: string };
}

export interface OutboundOptions {
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  /** Autor do envio; null = sistema (automação). */
  senderId?: string | null;
}

/**
 * Envio unificado de mensagem de saída: resolve o canal/credenciais (por Canal,
 * com fallback global), dispara via Evolution/Meta, persiste a Message (out) e
 * emite o evento em tempo real. Reutilizado pela rota de mensagens e pelo engine
 * de automações. Lança erro quando o envio falha.
 */
export async function sendOutboundMessage(
  conversation: OutboundConversation,
  opts: OutboundOptions
) {
  const { content, mediaUrl, mediaType, senderId } = opts;
  const channelType = conversation.channel.channelType;
  const to = conversation.channel.channelIdentifier;

  if (!content && !mediaUrl) {
    throw new Error("content ou media_url obrigatório");
  }

  let externalId: string | null = null;

  if (channelType === "whatsapp") {
    const ch = await getWhatsappChannel(conversation.inboxId);
    if (ch.provider === "cloud") {
      // API oficial (Meta Cloud API).
      if (!ch.phoneNumberId || !ch.accessToken) {
        throw new Error("Canal WhatsApp (API oficial) sem phone_number_id/token configurado");
      }
      const creds = { phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken };
      if (mediaUrl && mediaType) {
        const result = await cloud.sendMediaByLink(creds, to, { link: mediaUrl, type: mediaType, caption: content });
        externalId = result.id;
      } else if (content) {
        const result = await cloud.sendText(creds, to, content);
        externalId = result.id;
      }
    } else {
      // API não oficial (Evolution) — comportamento atual.
      const instance = await resolveWhatsappInstance(conversation.inboxId);
      if (mediaUrl && mediaType) {
        const result = await sendMedia(instance, to, mediaUrl, content ?? "", mediaType);
        externalId = result.key?.id ?? null;
      } else if (content) {
        const result = await sendText(instance, to, content);
        externalId = result.key?.id ?? null;
      }
    }
  } else if (channelType === "instagram" || channelType === "messenger") {
    if (!content) throw new Error("Envio de mídia ainda não suportado neste canal");
    if (channelType === "instagram") {
      await sendInstagramDirect(to, content, conversation.inboxId);
    } else {
      await sendMessengerMessage(to, content, conversation.inboxId);
    }
  } else {
    throw new Error(`Canal "${channelType}" não suporta envio`);
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "out",
      content: content ?? null,
      mediaUrl: mediaUrl ?? null,
      mediaType: mediaType ?? null,
      senderId: senderId ?? null,
      externalId,
    },
  });

  emitEvent("message:new", { conversationId: conversation.id, messageId: message.id });
  return message;
}
