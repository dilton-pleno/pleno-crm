import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { getMetaConfig } from "@/lib/meta-config";

// Credenciais Meta de ANÚNCIOS (Marketing API), separadas da mensageria. O
// token de anúncios pode ser próprio OU reaproveitar o da mensageria (mesmo app/
// token com escopo ads_read). Fallback: ads (DB) → mensageria (DB/env) → env.
const PROVIDER = "meta_ads";

interface StoredMetaAds {
  adAccountId?: string;
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

export interface MetaAdsConfig {
  accessToken: string | null;
  adAccountId: string | null;
}

export async function getMetaAdsConfig(): Promise<MetaAdsConfig> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const s = (row?.config as StoredMetaAds | null) ?? {};
  const ownToken = dec(s.accessTokenEnc);
  const accessToken = ownToken ?? (await getMetaConfig()).accessToken; // reaproveita o de mensageria
  return {
    accessToken: accessToken ?? null,
    adAccountId: s.adAccountId || process.env.META_AD_ACCOUNT_ID || null,
  };
}

export interface SaveMetaAdsInput {
  accessToken?: string;
  adAccountId?: string;
}

export async function saveMetaAdsConfig(input: SaveMetaAdsInput): Promise<void> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const current = (row?.config as StoredMetaAds | null) ?? {};
  const next: StoredMetaAds = { ...current };
  if (input.adAccountId !== undefined) next.adAccountId = input.adAccountId.trim() || undefined;
  if (input.accessToken) next.accessTokenEnc = encrypt(input.accessToken);

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

export async function getMetaAdsStatus(): Promise<{
  accessToken: boolean;
  ownToken: boolean;
  adAccountId: string | null;
}> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const s = (row?.config as StoredMetaAds | null) ?? {};
  const cfg = await getMetaAdsConfig();
  return {
    accessToken: Boolean(cfg.accessToken), // tem token (próprio ou herdado)
    ownToken: Boolean(dec(s.accessTokenEnc)), // tem token próprio de ads
    adAccountId: cfg.adAccountId,
  };
}
