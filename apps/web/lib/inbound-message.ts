import type { ChannelType, MediaType, MessageDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";
import { runAutomationsFor } from "@/lib/automation-engine";

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
  /**
   * Direção da mensagem. "in" (padrão) = recebida do contato; "out" = enviada
   * pelo operador, inclusive respostas feitas direto pelo app do WhatsApp no
   * celular (fromMe), que o webhook ecoa.
   */
  direction?: MessageDirection;
  content: string | null;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  /** Bytes da mídia já descriptografada (WhatsApp via Evolution) */
  mediaData?: Uint8Array<ArrayBuffer> | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  sentAt: Date;
  /** Rótulo da inbox exibido na UI (ex.: "WhatsApp", "Instagram") */
  inboxName: string;
  /** Canal (Inbox) que originou a mensagem; null cai no Canal Padrão. */
  inboxId?: string | null;
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
  const isNewContact = !existingChannel;

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
        inboxId: msg.inboxId ?? null,
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
        inboxId: msg.inboxId ?? null,
      },
    });

    // Cria automaticamente um card no primeiro estágio do pipeline padrão
    // (isDefault; fallback para o pipeline mais antigo).
    const defaultPipeline =
      (await prisma.pipeline.findFirst({ where: { isDefault: true } })) ??
      (await prisma.pipeline.findFirst({ orderBy: { createdAt: "asc" } }));
    if (defaultPipeline) {
      const firstStage = await prisma.pipelineStage.findFirst({
        where: { pipelineId: defaultPipeline.id },
        orderBy: { position: "asc" },
      });
      if (firstStage) {
        await prisma.pipelineCard.create({
          data: {
            stageId: firstStage.id,
            conversationId: conversation.id,
            contactId,
          },
        });
      }
    }
  }

  const existing = await prisma.message.findFirst({ where: { externalId: msg.externalId } });
  if (existing) return;

  const direction = msg.direction ?? "in";

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction,
      content: msg.content,
      mediaUrl: msg.mediaUrl ?? null,
      mediaType: msg.mediaType ?? null,
      mediaData: msg.mediaData ?? null,
      mediaMimeType: msg.mediaMimeType ?? null,
      mediaFileName: msg.mediaFileName ?? null,
      externalId: msg.externalId,
      sentAt: msg.sentAt,
    },
  });

  // Resposta enviada pelo operador (incl. pelo celular) significa que as
  // mensagens recebidas anteriores já foram vistas: marca como lidas para o
  // badge de não-lidas refletir a realidade.
  if (direction === "out") {
    await prisma.message.updateMany({
      where: { conversationId: conversation.id, direction: "in", readAt: null },
      data: { readAt: new Date() },
    });
  }

  if (isNewConversation) {
    emitEvent("conversation:new", { conversationId: conversation.id, contactId });
  } else {
    emitEvent("message:new", { conversationId: conversation.id, messageId: message.id });
  }

  // Automações: só para mensagens recebidas do contato (direction "in"); o eco
  // de saída não dispara gatilhos. Tolerante a falhas (não quebra a ingestão).
  if (direction === "in") {
    const base = {
      conversationId: conversation.id,
      contactId,
      inboxId: msg.inboxId ?? null,
      channelType: msg.channelType,
      messageContent: msg.content,
    };
    await runAutomationsFor({ trigger: "new_message", ...base });
    if (msg.content) await runAutomationsFor({ trigger: "keyword", ...base });
    if (isNewContact) await runAutomationsFor({ trigger: "new_contact", ...base });
    if (isNewConversation) await runAutomationsFor({ trigger: "conversation_opened", ...base });
  }
}
