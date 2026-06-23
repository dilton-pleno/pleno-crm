import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";

type WhatsAppEvent = "messages.upsert" | "messages.update" | "connection.update";

interface WebhookPayload {
  event: WhatsAppEvent;
  instance: string;
  data: MessageUpsertData | MessageUpdateData | ConnectionUpdateData;
}

interface MessageUpsertData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    imageMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string };
    documentMessage?: { url?: string; title?: string };
    stickerMessage?: { url?: string };
    videoMessage?: { caption?: string; url?: string };
  };
  messageTimestamp: number;
  pushName?: string;
}

interface MessageUpdateData {
  key: { remoteJid: string; id: string };
  update: { status?: number };
}

interface ConnectionUpdateData {
  state?: string;
  statusReason?: number;
}

function extractPhone(remoteJid: string): string {
  return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

function extractMediaInfo(data: MessageUpsertData): {
  content: string | null;
  mediaUrl: string | null;
  mediaType: "image" | "audio" | "document" | "sticker" | "video" | null;
} {
  const msg = data.message;
  if (!msg) return { content: null, mediaUrl: null, mediaType: null };

  if (msg.conversation) {
    return { content: msg.conversation, mediaUrl: null, mediaType: null };
  }
  if (msg.imageMessage) {
    return { content: msg.imageMessage.caption ?? null, mediaUrl: msg.imageMessage.url ?? null, mediaType: "image" };
  }
  if (msg.audioMessage) {
    return { content: null, mediaUrl: msg.audioMessage.url ?? null, mediaType: "audio" };
  }
  if (msg.documentMessage) {
    return { content: msg.documentMessage.title ?? null, mediaUrl: msg.documentMessage.url ?? null, mediaType: "document" };
  }
  if (msg.stickerMessage) {
    return { content: null, mediaUrl: msg.stickerMessage.url ?? null, mediaType: "sticker" };
  }
  if (msg.videoMessage) {
    return { content: msg.videoMessage.caption ?? null, mediaUrl: msg.videoMessage.url ?? null, mediaType: "video" };
  }
  return { content: null, mediaUrl: null, mediaType: null };
}

async function handleMessageUpsert(data: MessageUpsertData): Promise<void> {
  if (data.key.fromMe) return;

  const phone = extractPhone(data.key.remoteJid);
  const { content, mediaUrl, mediaType } = extractMediaInfo(data);
  const sentAt = new Date(data.messageTimestamp * 1000);

  // Contact has no @unique on phone, so we use findFirst + create
  const existingContact = await prisma.contact.findFirst({ where: { phone } });
  const resolvedContact = existingContact ?? await prisma.contact.create({
    data: { name: data.pushName ?? phone, phone },
  });

  const channel = await prisma.contactChannel.upsert({
    where: {
      channelType_channelIdentifier: {
        channelType: "whatsapp",
        channelIdentifier: phone,
      },
    },
    create: {
      contactId: resolvedContact.id,
      channelType: "whatsapp",
      channelIdentifier: phone,
    },
    update: {},
  });

  let conversation = await prisma.conversation.findFirst({
    where: {
      channelId: channel.id,
      status: { not: "resolved" },
    },
  });

  const isNewConversation = !conversation;

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        contactId: resolvedContact.id,
        channelId: channel.id,
        status: "open",
        inboxName: "WhatsApp",
      },
    });
  } else if (conversation.status === "resolved") {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "open", updatedAt: new Date() },
    });
  }

  const existing = await prisma.message.findFirst({ where: { externalId: data.key.id } });
  if (existing) return;

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "in",
      content,
      mediaUrl,
      mediaType: mediaType as "image" | "audio" | "document" | "sticker" | "video" | undefined,
      externalId: data.key.id,
      sentAt,
    },
  });

  if (isNewConversation) {
    emitEvent("conversation:new", {
      conversationId: conversation.id,
      contactId: resolvedContact.id,
    });
  } else {
    emitEvent("message:new", {
      conversationId: conversation.id,
      messageId: message.id,
    });
  }
}

async function handleMessageUpdate(data: MessageUpdateData): Promise<void> {
  const { key, update } = data;
  if (!update.status) return;

  // Evolution status: 3 = delivered, 4 = read
  const now = new Date();
  if (update.status === 3) {
    await prisma.message.updateMany({
      where: { externalId: key.id, deliveredAt: null },
      data: { deliveredAt: now },
    });
  } else if (update.status === 4) {
    await prisma.message.updateMany({
      where: { externalId: key.id, readAt: null },
      data: { readAt: now },
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid webhook secret" } },
      { status: 401 }
    );
  }

  // Return 200 immediately to avoid N8N timeout, process async
  const payload = (await request.json()) as WebhookPayload;

  setImmediate(async () => {
    try {
      if (payload.event === "messages.upsert") {
        await handleMessageUpsert(payload.data as MessageUpsertData);
      } else if (payload.event === "messages.update") {
        await handleMessageUpdate(payload.data as MessageUpdateData);
      }
      // connection.update: log only, no DB action needed
    } catch (err) {
      console.error("[webhook/whatsapp] Erro ao processar evento:", err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
