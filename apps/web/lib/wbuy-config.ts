import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import type { WbuyCreds } from "@/lib/wbuy";

const PROVIDER = "wbuy";

export interface ImportStatus {
  status: "running" | "done" | "error";
  imported?: number;
  start?: string;
  finishedAt?: string;
}

/**
 * Lê as credenciais Wbuy decifradas. Retorna null se não houver config salva.
 */
export async function getWbuyCreds(): Promise<WbuyCreds | null> {
  const config = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  if (!config?.apiUser || !config.apiSecret) return null;
  return { user: config.apiUser, secret: decrypt(config.apiSecret) };
}

/**
 * Salva (upsert) as credenciais Wbuy, cifrando o segredo.
 */
export async function saveWbuyCreds(apiUser: string, apiSecret: string): Promise<void> {
  const encrypted = encrypt(apiSecret);
  await prisma.integrationConfig.upsert({
    where: { provider: PROVIDER },
    update: { apiUser, apiSecret: encrypted, active: true },
    create: { provider: PROVIDER, apiUser, apiSecret: encrypted, active: true },
  });
}

/**
 * Status para a UI (sem expor o segredo): usuário mascarado, credencial e a
 * última importação de histórico.
 */
export async function getWbuyStatus(): Promise<{
  configured: boolean;
  apiUserMasked: string | null;
  active: boolean;
  lastImport: ImportStatus | null;
}> {
  const config = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  if (!config?.apiUser) {
    return { configured: false, apiUserMasked: null, active: false, lastImport: null };
  }
  const u = config.apiUser;
  const masked = u.length > 8 ? `${u.slice(0, 4)}…${u.slice(-4)}` : "••••";
  const cfg = (config.config ?? {}) as { lastImport?: ImportStatus };
  return {
    configured: Boolean(config.apiSecret),
    apiUserMasked: masked,
    active: config.active,
    lastImport: cfg.lastImport ?? null,
  };
}

/**
 * Atualiza o status da última importação de histórico no campo config.
 */
export async function setWbuyImportStatus(status: ImportStatus): Promise<void> {
  const config = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  const current = (config?.config ?? {}) as Record<string, unknown>;
  await prisma.integrationConfig.update({
    where: { provider: PROVIDER },
    data: { config: { ...current, lastImport: status } as unknown as Prisma.InputJsonValue },
  });
}
