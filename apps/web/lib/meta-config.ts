import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// Credenciais Meta (Facebook/Instagram/Messenger + Ads) configuráveis pelo
// painel. Segredos ficam cifrados no IntegrationConfig (provider "meta").
// Mantém fallback para variáveis de ambiente, para não quebrar produção
// enquanto a migração para o painel não acontece.
const PROVIDER = "meta";

export interface MetaConfig {
  appId: string | null;
  appSecret: string | null;
  accessToken: string | null;
  pageId: string | null;
  adAccountId: string | null;
  verifyToken: string | null;
}

// Como cada campo é guardado: texto puro (não-segredo) ou cifrado.
interface StoredMeta {
  appId?: string;
  pageId?: string;
  adAccountId?: string;
  appSecretEnc?: string;
  accessTokenEnc?: string;
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

/** Lê as credenciais Meta (banco cifrado, com fallback para env). */
export async function getMetaConfig(): Promise<MetaConfig> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const s = (row?.config as StoredMeta | null) ?? {};
  return {
    appId: s.appId || process.env.META_APP_ID || null,
    appSecret: dec(s.appSecretEnc) ?? process.env.META_APP_SECRET ?? null,
    accessToken: dec(s.accessTokenEnc) ?? process.env.META_ACCESS_TOKEN ?? null,
    pageId: s.pageId || process.env.META_PAGE_ID || null,
    adAccountId: s.adAccountId || process.env.META_AD_ACCOUNT_ID || null,
    verifyToken: dec(s.verifyTokenEnc) ?? process.env.META_WEBHOOK_VERIFY_TOKEN ?? null,
  };
}

export interface SaveMetaInput {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  pageId?: string;
  adAccountId?: string;
  verifyToken?: string;
}

/** Salva (merge) as credenciais Meta, cifrando os segredos. Campos vazios são ignorados. */
export async function saveMetaConfig(input: SaveMetaInput): Promise<void> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const current = (row?.config as StoredMeta | null) ?? {};
  const next: StoredMeta = { ...current };

  if (input.appId !== undefined) next.appId = input.appId.trim() || undefined;
  if (input.pageId !== undefined) next.pageId = input.pageId.trim() || undefined;
  if (input.adAccountId !== undefined) next.adAccountId = input.adAccountId.trim() || undefined;
  if (input.appSecret) next.appSecretEnc = encrypt(input.appSecret);
  if (input.accessToken) next.accessTokenEnc = encrypt(input.accessToken);
  if (input.verifyToken) next.verifyTokenEnc = encrypt(input.verifyToken);

  await prisma.integrationConfig.upsert({
    where: { provider: PROVIDER },
    update: { active: true, config: next as unknown as Prisma.InputJsonValue },
    create: {
      provider: PROVIDER,
      apiUser: "",
      apiSecret: "",
      active: true,
      config: next as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Status para a UI: quais campos estão preenchidos (sem expor segredos). */
export async function getMetaStatus(): Promise<{
  appId: boolean;
  appSecret: boolean;
  accessToken: boolean;
  pageId: string | null;
  adAccountId: string | null;
  verifyToken: boolean;
}> {
  const cfg = await getMetaConfig();
  return {
    appId: Boolean(cfg.appId),
    appSecret: Boolean(cfg.appSecret),
    accessToken: Boolean(cfg.accessToken),
    pageId: cfg.pageId,
    adAccountId: cfg.adAccountId,
    verifyToken: Boolean(cfg.verifyToken),
  };
}
