import { prisma } from "@/lib/prisma";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";

// Vínculo conta de anúncio → loja (integração e-commerce). Cada conta (Meta ad
// account, Google customer, GA4 property) pertence a uma loja; o sync usa isto
// para carimbar a loja nas métricas e permitir ROI por loja.

export type AdChannel = "meta" | "google" | "ga4";

/**
 * Loja dona da conta de anúncio informada. Cai na loja padrão quando a conta
 * ainda não foi mapeada (ou não há accountId), garantindo que nenhuma métrica
 * fique órfã. Null só se não existir loja alguma.
 */
export async function resolveAdStoreId(
  platform: AdChannel,
  accountId: string | null
): Promise<string | null> {
  if (accountId) {
    const map = await prisma.adAccountStore.findUnique({
      where: { platform_accountId: { platform, accountId } },
    });
    if (map) return map.storeIntegrationId;

    // Conta vista pela 1ª vez: registra já vinculada à loja padrão, para poder
    // ser reatribuída na tela. (catch silencioso p/ corrida de unique.)
    const def = await getDefaultStoreIntegrationId();
    if (def) {
      await prisma.adAccountStore
        .create({ data: { platform, accountId, storeIntegrationId: def } })
        .catch(() => undefined);
    }
    return def;
  }
  return getDefaultStoreIntegrationId();
}
