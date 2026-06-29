import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Config compartilhada da instância WhatsApp em IntegrationConfig (provider
// "whatsapp"). Vários recursos gravam aqui (histórico, estado de conexão), então
// SEMPRE faça merge — nunca sobrescreva o objeto `config` inteiro.
const PROVIDER = "whatsapp";

export type WhatsappConfig = Record<string, unknown>;

export async function getWhatsappConfig(): Promise<WhatsappConfig> {
  const row = await prisma.integrationConfig.findUnique({ where: { provider: PROVIDER } });
  return (row?.config as WhatsappConfig | null) ?? {};
}

/** Mescla `patch` no config existente (cria a linha se não houver). */
export async function mergeWhatsappConfig(patch: WhatsappConfig): Promise<void> {
  const current = await getWhatsappConfig();
  const merged = { ...current, ...patch } as unknown as Prisma.InputJsonValue;
  await prisma.integrationConfig.upsert({
    where: { provider: PROVIDER },
    update: { config: merged },
    create: { provider: PROVIDER, apiUser: "", apiSecret: "", active: true, config: merged },
  });
}
