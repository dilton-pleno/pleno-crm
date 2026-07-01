/**
 * Migração de dados — cria Integration (instâncias) a partir do estado atual e
 * liga cada Canal (Inbox) à sua integração de WhatsApp/Meta. Idempotente.
 *
 * Regras por Canal:
 *  - WhatsApp: se o Canal tem provider "cloud" com phone/token OU instância
 *    Evolution própria, cria a Integration equivalente e liga. Para o Canal
 *    Padrão sem config própria, cria "Atendimento" (Evolution) do EVOLUTION_INSTANCE.
 *  - Meta: se o Canal tem page/IG/token próprios, cria e liga. Para o Canal
 *    Padrão sem config própria, cria "Meta principal" a partir da config global
 *    (IntegrationConfig provider "meta").
 * Segredos já cifrados são COPIADOS como estão (mesma ENCRYPTION_KEY), sem re-cifrar.
 *
 * Uso (a partir de apps/web, DATABASE_URL apontando para o banco alvo):
 *   node --env-file=.env --import tsx prisma/migrate-integrations.ts            # DRY-RUN
 *   node --env-file=.env --import tsx prisma/migrate-integrations.ts --confirm  # aplica
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_INBOX_ID = "00000000-0000-0000-0000-000000000001";

interface WaStored { accessTokenEnc?: string; wabaId?: string; verifyTokenEnc?: string }
interface MetaStored { accessTokenEnc?: string; pageId?: string; igId?: string }

async function main(): Promise<void> {
  const confirm = process.argv.includes("--confirm");
  const plans: string[] = [];

  const inboxes = await prisma.inbox.findMany({ orderBy: { createdAt: "asc" } });
  const globalMetaRow = await prisma.integrationConfig.findUnique({ where: { provider: "meta" } });
  const globalMeta = (globalMetaRow?.config as MetaStored | null) ?? {};
  const envInstance = process.env.EVOLUTION_INSTANCE ?? null;

  for (const inbox of inboxes) {
    const isDefault = inbox.id === DEFAULT_INBOX_ID;

    // ---- WhatsApp ----
    if (!inbox.whatsappIntegrationId) {
      const waCfg = (inbox.whatsappConfig as WaStored | null) ?? {};
      if (inbox.whatsappProvider === "cloud" && (inbox.whatsappPhoneNumberId || waCfg.accessTokenEnc)) {
        plans.push(`Canal "${inbox.name}": criar Integration WhatsApp CLOUD (phone ${inbox.whatsappPhoneNumberId ?? "—"})`);
        if (confirm) {
          const created = await prisma.integration.create({
            data: {
              type: "whatsapp", name: inbox.name, provider: "cloud",
              waPhoneNumberId: inbox.whatsappPhoneNumberId,
              config: (inbox.whatsappConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            },
          });
          await prisma.inbox.update({ where: { id: inbox.id }, data: { whatsappIntegrationId: created.id } });
        }
      } else if (inbox.whatsappInstance) {
        plans.push(`Canal "${inbox.name}": criar Integration WhatsApp EVOLUTION (instância ${inbox.whatsappInstance})`);
        if (confirm) {
          const created = await prisma.integration.create({
            data: { type: "whatsapp", name: inbox.name, provider: "evolution", waInstance: inbox.whatsappInstance },
          });
          await prisma.inbox.update({ where: { id: inbox.id }, data: { whatsappIntegrationId: created.id } });
        }
      } else if (isDefault && envInstance) {
        plans.push(`Canal Padrão: criar Integration WhatsApp EVOLUTION "Atendimento" (instância ${envInstance}, do env)`);
        if (confirm) {
          const created = await prisma.integration.create({
            data: { type: "whatsapp", name: "Atendimento", provider: "evolution", waInstance: envInstance },
          });
          await prisma.inbox.update({ where: { id: inbox.id }, data: { whatsappIntegrationId: created.id } });
        }
      }
    }

    // ---- Meta ----
    if (!inbox.metaIntegrationId) {
      const metaCfg = (inbox.metaConfig as MetaStored | null) ?? {};
      if (inbox.metaPageId || inbox.metaIgId || metaCfg.accessTokenEnc) {
        plans.push(`Canal "${inbox.name}": criar Integration META (page ${inbox.metaPageId ?? "—"}, IG ${inbox.metaIgId ?? "—"})`);
        if (confirm) {
          const created = await prisma.integration.create({
            data: {
              type: "meta", name: inbox.name, provider: null,
              metaPageId: inbox.metaPageId, metaIgId: inbox.metaIgId,
              config: (inbox.metaConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            },
          });
          await prisma.inbox.update({ where: { id: inbox.id }, data: { metaIntegrationId: created.id } });
        }
      } else if (isDefault && (globalMeta.pageId || globalMeta.igId || globalMeta.accessTokenEnc)) {
        plans.push(`Canal Padrão: criar Integration META "Meta principal" (page ${globalMeta.pageId ?? "—"}, do global)`);
        if (confirm) {
          const created = await prisma.integration.create({
            data: {
              type: "meta", name: "Meta principal", provider: null,
              metaPageId: globalMeta.pageId ?? null, metaIgId: globalMeta.igId ?? null,
              config: globalMeta.accessTokenEnc ? ({ accessTokenEnc: globalMeta.accessTokenEnc } as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
          });
          await prisma.inbox.update({ where: { id: inbox.id }, data: { metaIntegrationId: created.id } });
        }
      }
    }
  }

  console.log("=== MIGRAÇÃO DE INTEGRAÇÕES ===");
  if (plans.length === 0) console.log("Nada a migrar (tudo já vinculado ou sem config).");
  else plans.forEach((p) => console.log(" - " + p));
  console.log("===============================");
  console.log(confirm ? "\nAplicado." : `\nDRY-RUN: ${plans.length} ação(ões). Rode com --confirm para aplicar.`);
}

main()
  .catch((err) => {
    console.error("Falha na migração:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
