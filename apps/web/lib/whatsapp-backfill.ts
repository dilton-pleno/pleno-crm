import { prisma } from "@/lib/prisma";
import { findChats, findMessages, type WaMessageRecord } from "@/lib/evolution";
import { getWhatsappConfig, mergeWhatsappConfig } from "@/lib/whatsapp-config";
import { resolveInboxByWhatsappInstance } from "@/lib/inbox-routing";

function extractPhone(remoteJid: string): string {
  return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "").split(":")[0] ?? remoteJid;
}

/**
 * Conteúdo da mensagem para o histórico: texto quando houver, senão um marcador
 * de mídia (sem baixar bytes). Retorna null para mensagens sem conteúdo útil.
 */
function extractContent(msg: WaMessageRecord["message"]): string | null {
  if (!msg) return null;
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage) return msg.imageMessage.caption?.trim() || "[imagem]";
  if (msg.audioMessage) return "[áudio]";
  if (msg.videoMessage) return msg.videoMessage.caption?.trim() || "[vídeo]";
  if (msg.documentMessage)
    return msg.documentMessage.caption?.trim() || msg.documentMessage.fileName || msg.documentMessage.title || "[documento]";
  if (msg.stickerMessage) return "[figurinha]";
  return null;
}

function tsToDate(ts: number | string | undefined): Date {
  const n = typeof ts === "string" ? parseInt(ts, 10) : ts ?? 0;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) || n === 0 ? new Date() : d;
}

/**
 * Importa uma mensagem histórica sem efeitos do fluxo realtime (não cria card,
 * não emite WebSocket, não reabre conversa). Deduplica por externalId.
 * Retorna true se a mensagem foi criada.
 */
async function backfillMessage(record: WaMessageRecord, inboxId: string | null): Promise<boolean> {
  const externalId = record.key?.id;
  if (!externalId) return false;

  const existing = await prisma.message.findFirst({ where: { externalId }, select: { id: true } });
  if (existing) return false;

  const content = extractContent(record.message);
  if (!content) return false;

  const phone = extractPhone(record.key.remoteJid);
  if (!phone) return false;

  // Resolve contato + canal (whatsapp, telefone).
  let channel = await prisma.contactChannel.findUnique({
    where: { channelType_channelIdentifier: { channelType: "whatsapp", channelIdentifier: phone } },
  });
  if (!channel) {
    const name = record.key.fromMe ? phone : record.pushName?.trim() || phone;
    const contact = await prisma.contact.create({ data: { name, phone } });
    channel = await prisma.contactChannel.create({
      data: { contactId: contact.id, channelType: "whatsapp", channelIdentifier: phone, inboxId },
    });
  }

  // Conversa: usa a mais recente do canal (qualquer status) ou cria uma
  // resolvida só para abrigar o histórico (sem poluir a caixa de entrada).
  let conversation = await prisma.conversation.findFirst({
    where: { channelId: channel.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { contactId: channel.contactId, channelId: channel.id, status: "resolved", inboxName: "WhatsApp", inboxId },
      select: { id: true },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: record.key.fromMe ? "out" : "in",
      content,
      externalId,
      sentAt: tsToDate(record.messageTimestamp),
      readAt: new Date(), // histórico já lido, não conta como não lida
    },
  });
  return true;
}

export interface BackfillProgress {
  status: "running" | "done" | "error";
  chats: number;
  imported: number;
  start: string;
  finishedAt?: string;
  error?: string;
}

async function setProgress(p: BackfillProgress): Promise<void> {
  await mergeWhatsappConfig({ lastHistoryImport: p });
}

export async function getBackfillProgress(): Promise<BackfillProgress | null> {
  const cfg = await getWhatsappConfig();
  return (cfg.lastHistoryImport as BackfillProgress | undefined) ?? null;
}

const PAGE_LIMIT = 50;

/**
 * Backfill de todos os chats individuais (pula grupos) dos últimos `days` dias.
 * Roda em background (chamado via setImmediate). Grava progresso em IntegrationConfig.
 */
export async function backfillAllChats(instanceName: string, days = 90): Promise<void> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const startISO = new Date().toISOString();
  let imported = 0;
  let chatsDone = 0;

  await setProgress({ status: "running", chats: 0, imported: 0, start: startISO });

  // Canal de origem (instância → Inbox, fallback Canal Padrão), resolvido uma vez.
  const inboxId = await resolveInboxByWhatsappInstance(instanceName);

  try {
    const chats = (await findChats(instanceName)).filter(
      (c) => c.remoteJid.endsWith("@s.whatsapp.net") || !c.remoteJid.includes("@")
    );

    for (const chat of chats) {
      for (let page = 1; page <= PAGE_LIMIT; page++) {
        const { records, pages, currentPage } = await findMessages(instanceName, {
          remoteJid: chat.remoteJid,
          page,
        });
        if (records.length === 0) break;

        let allOld = true;
        for (const rec of records) {
          if (tsToDate(rec.messageTimestamp).getTime() < cutoff) continue;
          allOld = false;
          if (await backfillMessage(rec, inboxId)) imported++;
        }

        // Páginas vêm da mais recente p/ mais antiga; se a página inteira já é
        // anterior ao corte, não precisa continuar neste chat.
        if (allOld) break;
        if (currentPage >= pages) break;
      }
      chatsDone++;
      if (chatsDone % 10 === 0) {
        await setProgress({ status: "running", chats: chatsDone, imported, start: startISO });
      }
    }

    await setProgress({
      status: "done",
      chats: chatsDone,
      imported,
      start: startISO,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[whatsapp-backfill] Erro:", err);
    await setProgress({
      status: "error",
      chats: chatsDone,
      imported,
      start: startISO,
      finishedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
