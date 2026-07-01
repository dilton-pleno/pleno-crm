import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// Credenciais Google (Ads + Analytics + Merchant) configuráveis pelo painel.
// Segredos cifrados no IntegrationConfig (provider "google"), com fallback para
// variáveis de ambiente. O refresh token é obtido uma vez (fora do painel) e
// colado aqui — não há fluxo OAuth no painel nesta fase.
const PROVIDER = "google";

export interface GoogleConfig {
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  adsDeveloperToken: string | null;
  adsCustomerId: string | null;
  ga4PropertyId: string | null;
  merchantId: string | null;
}

interface StoredGoogle {
  clientId?: string;
  adsCustomerId?: string;
  ga4PropertyId?: string;
  merchantId?: string;
  clientSecretEnc?: string;
  refreshTokenEnc?: string;
  adsDeveloperTokenEnc?: string;
}

function dec(v: string | undefined): string | null {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

export async function getGoogleConfig(): Promise<GoogleConfig> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const s = (row?.config as StoredGoogle | null) ?? {};
  return {
    clientId: s.clientId || process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: dec(s.clientSecretEnc) ?? process.env.GOOGLE_CLIENT_SECRET ?? null,
    refreshToken: dec(s.refreshTokenEnc) ?? process.env.GOOGLE_ADS_REFRESH_TOKEN ?? null,
    adsDeveloperToken: dec(s.adsDeveloperTokenEnc) ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? null,
    adsCustomerId: s.adsCustomerId || process.env.GOOGLE_ADS_CUSTOMER_ID || null,
    ga4PropertyId: s.ga4PropertyId || process.env.GA4_PROPERTY_ID || null,
    merchantId: s.merchantId || process.env.MERCHANT_CENTER_ID || null,
  };
}

export interface SaveGoogleInput {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  adsDeveloperToken?: string;
  adsCustomerId?: string;
  ga4PropertyId?: string;
  merchantId?: string;
}

export async function saveGoogleConfig(input: SaveGoogleInput): Promise<void> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const current = (row?.config as StoredGoogle | null) ?? {};
  const next: StoredGoogle = { ...current };

  if (input.clientId !== undefined) next.clientId = input.clientId.trim() || undefined;
  if (input.adsCustomerId !== undefined) next.adsCustomerId = input.adsCustomerId.trim() || undefined;
  if (input.ga4PropertyId !== undefined) next.ga4PropertyId = input.ga4PropertyId.trim() || undefined;
  if (input.merchantId !== undefined) next.merchantId = input.merchantId.trim() || undefined;
  if (input.clientSecret) next.clientSecretEnc = encrypt(input.clientSecret);
  if (input.refreshToken) next.refreshTokenEnc = encrypt(input.refreshToken);
  if (input.adsDeveloperToken) next.adsDeveloperTokenEnc = encrypt(input.adsDeveloperToken);

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

export async function getGoogleStatus(): Promise<{
  clientId: boolean;
  clientSecret: boolean;
  refreshToken: boolean;
  adsDeveloperToken: boolean;
  adsCustomerId: string | null;
  ga4PropertyId: string | null;
  merchantId: string | null;
}> {
  const cfg = await getGoogleConfig();
  return {
    clientId: Boolean(cfg.clientId),
    clientSecret: Boolean(cfg.clientSecret),
    refreshToken: Boolean(cfg.refreshToken),
    adsDeveloperToken: Boolean(cfg.adsDeveloperToken),
    adsCustomerId: cfg.adsCustomerId,
    ga4PropertyId: cfg.ga4PropertyId,
    merchantId: cfg.merchantId,
  };
}

/** Troca o refresh token por um access token (OAuth) usando as credenciais do config. */
export async function getGoogleAccessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = await getGoogleConfig();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais OAuth do Google não configuradas");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google OAuth falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}
