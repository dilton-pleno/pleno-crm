import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt, safeEqual } from "@/lib/crypto";

// Resolve qual provider de WhatsApp e quais credenciais um Canal (Inbox) usa.
// "evolution" (API não oficial) é o default; "cloud" é a API oficial da Meta.
// Segredos do Cloud ficam cifrados em Inbox.whatsappConfig; há fallback para
// variáveis de ambiente globais, no mesmo espírito de lib/inbox-config.ts.

export type WhatsappProvider = "evolution" | "cloud";

export interface WhatsappChannel {
  provider: WhatsappProvider;
  // Evolution
  instance: string | null;
  // Cloud API (oficial)
  phoneNumberId: string | null;
  accessToken: string | null;
  wabaId: string | null;
  verifyToken: string | null;
}

interface StoredCloud {
  accessTokenEnc?: string;
  wabaId?: string;
  verifyTokenEnc?: string;
}

function dec(v: string | undefined): string | null {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

function envDefaults(): WhatsappChannel {
  return {
    provider: "evolution",
    instance: process.env.EVOLUTION_INSTANCE ?? null,
    phoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID ?? null,
    accessToken: process.env.WHATSAPP_CLOUD_TOKEN ?? null,
    wabaId: process.env.WHATSAPP_CLOUD_WABA_ID ?? null,
    verifyToken:
      process.env.WHATSAPP_CLOUD_VERIFY_TOKEN ?? process.env.META_WEBHOOK_VERIFY_TOKEN ?? null,
  };
}

/**
 * Config de WhatsApp de um Canal. Sem inboxId, retorna os defaults de env
 * (provider evolution) — comportamento idêntico ao atual.
 */
export async function getWhatsappChannel(inboxId?: string | null): Promise<WhatsappChannel> {
  const env = envDefaults();
  if (!inboxId) return env;

  const inbox = await prisma.inbox.findUnique({
    where: { id: inboxId },
    select: {
      whatsappProvider: true,
      whatsappInstance: true,
      whatsappPhoneNumberId: true,
      whatsappConfig: true,
    },
  });
  if (!inbox) return env;

  const s = (inbox.whatsappConfig as StoredCloud | null) ?? {};
  return {
    provider: inbox.whatsappProvider === "cloud" ? "cloud" : "evolution",
    instance: inbox.whatsappInstance || env.instance,
    phoneNumberId: inbox.whatsappPhoneNumberId || env.phoneNumberId,
    accessToken: dec(s.accessTokenEnc) ?? env.accessToken,
    wabaId: s.wabaId || env.wabaId,
    verifyToken: dec(s.verifyTokenEnc) ?? env.verifyToken,
  };
}

/**
 * Mescla credenciais do Cloud (cifradas) no whatsappConfig atual do Canal.
 * Campos vazios mantêm o valor existente. Retorna o JSON pronto para gravar.
 */
export function buildWhatsappCloudConfig(
  current: Prisma.JsonValue | null,
  input: { accessToken?: string; wabaId?: string; verifyToken?: string }
): Prisma.InputJsonValue {
  const next: StoredCloud = { ...((current as StoredCloud | null) ?? {}) };
  if (input.accessToken) next.accessTokenEnc = encrypt(input.accessToken);
  if (input.verifyToken) next.verifyTokenEnc = encrypt(input.verifyToken);
  if (input.wabaId !== undefined) next.wabaId = input.wabaId.trim() || undefined;
  return next as unknown as Prisma.InputJsonValue;
}

/** Indica se o Canal já tem token do Cloud guardado. */
export function inboxHasCloudToken(cfg: Prisma.JsonValue | null): boolean {
  return Boolean((cfg as StoredCloud | null)?.accessTokenEnc);
}

/** WABA id guardado no Canal (não é segredo), para exibir na UI. */
export function inboxCloudWabaId(cfg: Prisma.JsonValue | null): string | null {
  return (cfg as StoredCloud | null)?.wabaId ?? null;
}

/**
 * Valida o hub.verify_token da verificação do webhook (GET). Aceita o verify
 * token global (env) OU o de qualquer Canal "cloud" que tenha um próprio.
 * Comparação timing-safe.
 */
export async function verifyCloudToken(token: string | null): Promise<boolean> {
  if (!token) return false;

  const envToken =
    process.env.WHATSAPP_CLOUD_VERIFY_TOKEN ?? process.env.META_WEBHOOK_VERIFY_TOKEN ?? null;
  if (envToken && safeEqual(token, envToken)) return true;

  const cloudInboxes = await prisma.inbox.findMany({
    where: { whatsappProvider: "cloud" },
    select: { whatsappConfig: true },
  });
  for (const inbox of cloudInboxes) {
    const stored = dec((inbox.whatsappConfig as StoredCloud | null)?.verifyTokenEnc);
    if (stored && safeEqual(token, stored)) return true;
  }
  return false;
}
