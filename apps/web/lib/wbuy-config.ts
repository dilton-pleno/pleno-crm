import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import type { WbuyCreds } from "@/lib/wbuy";

const PROVIDER = "wbuy";

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
 * Status para a UI (sem expor o segredo): usuário mascarado e se há credencial.
 */
export async function getWbuyStatus(): Promise<{
  configured: boolean;
  apiUserMasked: string | null;
  active: boolean;
}> {
  const config = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  if (!config?.apiUser) {
    return { configured: false, apiUserMasked: null, active: false };
  }
  const u = config.apiUser;
  const masked = u.length > 8 ? `${u.slice(0, 4)}…${u.slice(-4)}` : "••••";
  return { configured: Boolean(config.apiSecret), apiUserMasked: masked, active: config.active };
}
