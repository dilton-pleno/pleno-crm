import type { ChannelType, MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";

export interface InboundMessage {
  channelType: ChannelType;
  /** Identificador no canal: telefone (WhatsApp) ou PSID/IGSID (Meta) */
  channelIdentifier: string;
  contactName: string;
  contactAvatarUrl?: string | null;
  /** Telefone do contato, quando aplicável (WhatsApp) */
  phone?: string | null;
  /** ID externo da mensagem para deduplicação (key.id / mid) */
  externalId: string;
  content: string | null;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  sentAt: Date;
  /** Rótulo da inbox exibido na UI (ex.: "WhatsApp", "Instagram") */
  inboxName: string;
}

/**
 * Ingestão unificada de mensagem recebida (qualquer canal):
 * resolve Contact + ContactChannel, reabre/cria Conversation, deduplica
 * por externalId, cria a Message (direction "in") e emite evento WebSocket.
 *
 * A resolução do contato é feita SEMPRE pelo par (channelType, channelIdentifier),
 * que é único — funciona para canais sem telefone (Instagram/Messenger).
 */
export async function ingestInboundMessage(msg: InboundMessage): Promise<void> {
  const existingChannel = await prisma.contactChannel.findUnique({
    where: {
      channelType_channelIdentifier: {
        channelType: msg.channelType,
        channelIdentifier: msg.channelIdentifier,
      },
    },
  });

  let channelId: string;
  let contactId: string;

  if (existingChannel) {
    channelId = existingChannel.id;
    contactId = existingChannel.contactId;
  } else {
    const contact = await prisma.contact.create({
      data: {
        name: msg.contactName,
        phone: msg.phone ?? null,
        avatarUrl: msg.contactAvatarUrl ?? null,
      },
    });
    const channel = await prisma.contactChannel.create({
      data: {
        contactId: contact.id,
        channelType: msg.channelType,
        channelIdentifier: msg.channelIdentifier,
      },
    });
    channelId = channel.id;
    contactId = contact.id;
  }

  let conversation = await prisma.conversation.findFirst({
    where: { channelId, status: { not: "resolved" } },
  });

  const isNewConversation = !conversation;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        contactId,
        channelId,
        status: "open",
        inboxName: msg.inboxName,
      },
    });
  }

  const existing = await prisma.message.findFirst({ where: { externalId: msg.externalId } });
  if (existing) return;

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "in",
      content: msg.content,
      mediaUrl: msg.mediaUrl ?? null,
      mediaType: msg.mediaType ?? null,
      externalId: msg.externalId,
      sentAt: msg.sentAt,
    },
  });

  if (isNewConversation) {
    emitEvent("conversation:new", { conversationId: conversation.id, contactId });
  } else {
    emitEvent("message:new", { conversationId: conversation.id, messageId: message.id });
  }
}
