import { Prisma, type Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// Camada das integrações como INSTÂNCIAS nomeadas (vários WhatsApp/Meta), criadas
// em Integrações e atribuídas a um Canal (1:1). Segredos cifrados em config JSON;
// identificadores de roteamento (instance/phone/page/ig) em colunas indexadas.

export type IntegrationType = "whatsapp" | "meta";
export type WhatsappProvider = "evolution" | "cloud";

interface WaStored {
  accessTokenEnc?: string;
  wabaId?: string;
  verifyTokenEnc?: string;
}
interface MetaStored {
  accessTokenEnc?: string;
}

function dec(v: string | undefined): string | null {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

// ---------- Credenciais derivadas de uma Integration ----------

export interface WhatsappCreds {
  provider: WhatsappProvider;
  instance: string | null;
  phoneNumberId: string | null;
  accessToken: string | null;
  wabaId: string | null;
  verifyToken: string | null;
}

export function whatsappCredsFromIntegration(row: Integration): WhatsappCreds {
  const cfg = (row.config as WaStored | null) ?? {};
  return {
    provider: row.provider === "cloud" ? "cloud" : "evolution",
    instance: row.waInstance ?? null,
    phoneNumberId: row.waPhoneNumberId ?? null,
    accessToken: dec(cfg.accessTokenEnc),
    wabaId: cfg.wabaId ?? null,
    verifyToken: dec(cfg.verifyTokenEnc),
  };
}

export interface MetaCreds {
  pageId: string | null;
  igId: string | null;
  accessToken: string | null;
}

export function metaCredsFromIntegration(row: Integration): MetaCreds {
  const cfg = (row.config as MetaStored | null) ?? {};
  return {
    pageId: row.metaPageId ?? null,
    igId: row.metaIgId ?? null,
    accessToken: dec(cfg.accessTokenEnc),
  };
}

// ---------- CRUD ----------

export interface IntegrationInput {
  type?: IntegrationType;
  name?: string;
  provider?: WhatsappProvider | null;
  active?: boolean;
  // roteamento
  waInstance?: string | null;
  waPhoneNumberId?: string | null;
  metaPageId?: string | null;
  metaIgId?: string | null;
  // segredos (só gravam se vierem preenchidos)
  accessToken?: string;
  wabaId?: string;
  verifyToken?: string;
}

const norm = (v: string | null | undefined): string | null | undefined =>
  v === undefined ? undefined : v?.trim() || null;

// Mescla os segredos no config atual, cifrando. Campos vazios mantêm o valor.
function buildConfig(
  type: IntegrationType,
  current: Prisma.JsonValue | null,
  input: IntegrationInput
): Prisma.InputJsonValue | undefined {
  const touched =
    input.accessToken !== undefined ||
    input.wabaId !== undefined ||
    input.verifyToken !== undefined;
  if (!touched) return undefined;

  if (type === "meta") {
    const next: MetaStored = { ...((current as MetaStored | null) ?? {}) };
    if (input.accessToken) next.accessTokenEnc = encrypt(input.accessToken);
    return next as unknown as Prisma.InputJsonValue;
  }
  const next: WaStored = { ...((current as WaStored | null) ?? {}) };
  if (input.accessToken) next.accessTokenEnc = encrypt(input.accessToken);
  if (input.verifyToken) next.verifyTokenEnc = encrypt(input.verifyToken);
  if (input.wabaId !== undefined) next.wabaId = input.wabaId.trim() || undefined;
  return next as unknown as Prisma.InputJsonValue;
}

export function listIntegrations(type?: IntegrationType) {
  return prisma.integration.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "asc" },
    include: { inboxWhatsapp: { select: { id: true, name: true } }, inboxMeta: { select: { id: true, name: true } } },
  });
}

export function getIntegration(id: string) {
  return prisma.integration.findUnique({ where: { id } });
}

export async function createIntegration(input: IntegrationInput): Promise<Integration> {
  const type = input.type === "meta" ? "meta" : "whatsapp";
  return prisma.integration.create({
    data: {
      type,
      name: (input.name ?? "").trim() || "Integração",
      provider: type === "whatsapp" ? (input.provider === "cloud" ? "cloud" : "evolution") : null,
      active: input.active ?? true,
      waInstance: norm(input.waInstance) ?? null,
      waPhoneNumberId: norm(input.waPhoneNumberId) ?? null,
      metaPageId: norm(input.metaPageId) ?? null,
      metaIgId: norm(input.metaIgId) ?? null,
      config: buildConfig(type, null, input) ?? Prisma.JsonNull,
    },
  });
}

export async function updateIntegration(id: string, input: IntegrationInput): Promise<Integration | null> {
  const existing = await prisma.integration.findUnique({ where: { id } });
  if (!existing) return null;
  const type = existing.type as IntegrationType;
  return prisma.integration.update({
    where: { id },
    data: {
      name: input.name?.trim() || undefined,
      active: input.active,
      provider: type === "whatsapp" && input.provider ? (input.provider === "cloud" ? "cloud" : "evolution") : undefined,
      waInstance: norm(input.waInstance),
      waPhoneNumberId: norm(input.waPhoneNumberId),
      metaPageId: norm(input.metaPageId),
      metaIgId: norm(input.metaIgId),
      config: buildConfig(type, existing.config, input),
    },
  });
}

/** Canal (Inbox) ao qual a integração está atribuída (WhatsApp ou Meta), ou null. */
export async function assignedInboxOf(id: string): Promise<{ id: string; name: string } | null> {
  const row = await prisma.integration.findUnique({
    where: { id },
    select: { inboxWhatsapp: { select: { id: true, name: true } }, inboxMeta: { select: { id: true, name: true } } },
  });
  return row?.inboxWhatsapp ?? row?.inboxMeta ?? null;
}

/** Indica se o config guarda token (para exibir "token ✓" sem expor segredo). */
export function integrationHasToken(cfg: Prisma.JsonValue | null): boolean {
  return Boolean((cfg as { accessTokenEnc?: string } | null)?.accessTokenEnc);
}
