import type { Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt, safeEqual } from "@/lib/crypto";
import { getWbuyCreds } from "@/lib/wbuy-config";
import type { WbuyCreds } from "@/lib/wbuy";

// Camada de LOJA (integração e-commerce). Cada loja é uma Integration
// (type "ecommerce", platform "wbuy"). Credenciais e webhookSecret cifrados no
// config. "Loja principal" tem id fixo (criada na migração a partir do
// IntegrationConfig "wbuy") e é o default durante a transição.

export const DEFAULT_STORE_INTEGRATION_ID = "00000000-0000-0000-0000-000000000002";

interface StoredEcom {
  apiUser?: string;
  apiSecretEnc?: string;
  webhookSecretEnc?: string;
}

function dec(v: string | undefined): string | null {
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

/** Id da loja padrão (id fixo; fallback p/ a loja e-commerce mais antiga). */
export async function getDefaultStoreIntegrationId(): Promise<string | null> {
  const byId = await prisma.integration.findUnique({
    where: { id: DEFAULT_STORE_INTEGRATION_ID },
    select: { id: true },
  });
  if (byId) return byId.id;
  const oldest = await prisma.integration.findFirst({
    where: { type: "ecommerce" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return oldest?.id ?? null;
}

/** Credenciais Wbuy de uma integração e-commerce (decifradas). */
export function ecommerceCredsFromIntegration(row: Integration): WbuyCreds | null {
  const cfg = (row.config as StoredEcom | null) ?? {};
  const secret = dec(cfg.apiSecretEnc);
  if (!cfg.apiUser || !secret) return null;
  return { user: cfg.apiUser, secret };
}

/**
 * Credenciais Wbuy da loja informada. Para a loja padrão, cai no
 * IntegrationConfig "wbuy" (global) se o config da integração não tiver creds.
 */
export async function getStoreCreds(storeIntegrationId: string): Promise<WbuyCreds | null> {
  const row = await prisma.integration.findUnique({ where: { id: storeIntegrationId } });
  const fromRow = row ? ecommerceCredsFromIntegration(row) : null;
  if (fromRow) return fromRow;
  if (storeIntegrationId === DEFAULT_STORE_INTEGRATION_ID) return getWbuyCreds();
  return null;
}

/** Secret de webhook próprio da loja (decifrado), quando definido. */
export function ecommerceWebhookSecret(row: Integration): string | null {
  return dec((row.config as StoredEcom | null)?.webhookSecretEnc);
}

/**
 * Valida o secret do webhook por-loja e retorna o id da loja se casar.
 * Comparação timing-safe.
 */
export async function resolveStoreByWebhookSecret(
  integrationId: string,
  secret: string | null
): Promise<string | null> {
  if (!secret) return null;
  const row = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!row || row.type !== "ecommerce") return null;
  const expected = ecommerceWebhookSecret(row);
  if (!expected) return null;
  return safeEqual(secret, expected) ? row.id : null;
}
