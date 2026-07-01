import { getCampaignInsights } from "@/lib/meta-ads";
import { getMetaAdsConfig } from "@/lib/meta-ads-config";
import { upsertCampaignMetrics, type CampaignSyncInput } from "@/lib/analytics-sync";

// Orquestra a COLETA (pull) de métricas reais das plataformas de anúncio para o
// banco. Cada plataforma busca o período dia-a-dia e faz upsert idempotente
// (que já carimba a loja via mapa conta→loja). Usado pelo botão "Sincronizar
// agora" (sob demanda) e pela rota interna diária (cron).

export interface PullRange {
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
}

/** Intervalo dos últimos `days` dias (inclui hoje), em YYYY-MM-DD (UTC). */
export function rangeFromDays(days: number): PullRange {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

/** Coleta as campanhas do Meta Ads no período e faz upsert por dia. */
export async function pullMetaAds(range: PullRange): Promise<number> {
  const { adAccountId } = await getMetaAdsConfig();
  if (!adAccountId) throw new Error("Conta de anúncios da Meta não configurada");

  const rows = await getCampaignInsights(adAccountId, range);

  // Agrupa por dia para o upsert (chave única é platform+campanha+data).
  const byDate = new Map<string, CampaignSyncInput["campaigns"]>();
  for (const r of rows) {
    const list = byDate.get(r.date) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      status: r.status,
      impressions: r.impressions,
      reach: r.reach,
      clicks: r.clicks,
      spend: r.spend,
      cpm: r.cpm,
      ctr: r.ctr,
      roas: r.roas,
      conversions: r.conversions,
    });
    byDate.set(r.date, list);
  }

  let total = 0;
  for (const [date, campaigns] of byDate) {
    total += await upsertCampaignMetrics("meta", { date, account_id: adAccountId, campaigns }, adAccountId);
  }
  return total;
}
