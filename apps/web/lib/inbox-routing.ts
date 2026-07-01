// Roteamento por Canal (Inbox) — Fase 2 do módulo 07.
// Resolve qual Canal originou uma mensagem (inbound) e quais credenciais usar
// no envio (outbound), sempre com fallback para o "Canal Padrão" / env, de modo
// que o setup de conta única atual continue funcionando sem alterações.

import { prisma } from "@/lib/prisma";

// "Canal Padrão" criado retroativamente na migração da Fase 1 (id fixo).
export const DEFAULT_INBOX_ID = "00000000-0000-0000-0000-000000000001";

/** Id do Canal Padrão (id fixo da migração; fallback p/ o Canal mais antigo). */
export async function getDefaultInboxId(): Promise<string | null> {
  const byId = await prisma.inbox.findUnique({
    where: { id: DEFAULT_INBOX_ID },
    select: { id: true },
  });
  if (byId) return byId.id;
  const oldest = await prisma.inbox.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return oldest?.id ?? null;
}

/** Canal correspondente a uma instância do Evolution (WhatsApp); fallback p/ Padrão. */
export async function resolveInboxByWhatsappInstance(
  instance: string | null | undefined
): Promise<string | null> {
  if (instance) {
    const found = await prisma.inbox.findFirst({
      where: { whatsappInstance: instance },
      select: { id: true },
    });
    if (found) return found.id;
  }
  return getDefaultInboxId();
}

/**
 * Canal "oficial" para disparos ativos: o Canal ativo mais antigo com provider
 * "cloud" (WhatsApp API oficial). Retorna null se nenhum estiver configurado —
 * nesse caso os disparos ativos (status de pedido/campanhas) ficam desligados.
 */
export async function getOfficialCloudInboxId(): Promise<string | null> {
  const inbox = await prisma.inbox.findFirst({
    where: { active: true, whatsappProvider: "cloud" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return inbox?.id ?? null;
}

/** Canal correspondente a um phone_number_id da WhatsApp Cloud API; fallback p/ Padrão. */
export async function resolveInboxByWhatsappPhoneNumberId(
  phoneNumberId: string | null | undefined
): Promise<string | null> {
  if (phoneNumberId) {
    const found = await prisma.inbox.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
      select: { id: true },
    });
    if (found) return found.id;
  }
  return getDefaultInboxId();
}

/** Canal correspondente a um page id / IG id da Meta; fallback p/ Padrão. */
export async function resolveInboxByMetaId(
  pageOrIgId: string | null | undefined
): Promise<string | null> {
  if (pageOrIgId) {
    const found = await prisma.inbox.findFirst({
      where: { OR: [{ metaPageId: pageOrIgId }, { metaIgId: pageOrIgId }] },
      select: { id: true },
    });
    if (found) return found.id;
  }
  return getDefaultInboxId();
}

/**
 * Instância do Evolution a usar no envio para esta conversa: a do Canal da
 * conversa quando definida, senão a global (EVOLUTION_INSTANCE).
 */
export async function resolveWhatsappInstance(
  inboxId: string | null | undefined
): Promise<string> {
  const fallback = process.env.EVOLUTION_INSTANCE ?? "atendimento";
  if (!inboxId) return fallback;
  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: { whatsappInstance: true },
  });
  return inbox?.whatsappInstance || fallback;
}
