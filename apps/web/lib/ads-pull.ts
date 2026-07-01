import type { AdPlatform } from "@prisma/client";
import { getCampaignInsights, type CampaignDayInsight } from "@/lib/meta-ads";
import { getMetaAdsConfig } from "@/lib/meta-ads-config";
import { getCampaignMetrics } from "@/lib/google-ads";
import { getGoogleConfig } from "@/lib/google-config";
import { getSessionMetrics } from "@/lib/ga4";
import { upsertGa4Rows } from "@/lib/ga4-sync";
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

/** Agrupa insights diários por data e faz upsert por dia (chave: plataforma+campanha+data). */
async function upsertDayInsights(
  platform: AdPlatform,
  accountId: string,
  rows: CampaignDayInsight[]
): Promise<number> {
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
    total += await upsertCampaignMetrics(platform, { date, account_id: accountId, campaigns }, accountId);
  }
  return total;
}

/** Coleta as campanhas do Meta Ads no período e faz upsert por dia. */
export async function pullMetaAds(range: PullRange): Promise<number> {
  const { adAccountId } = await getMetaAdsConfig();
  if (!adAccountId) throw new Error("Conta de anúncios da Meta não configurada");
  const rows = await getCampaignInsights(adAccountId, range);
  return upsertDayInsights("meta", adAccountId, rows);
}

/** Coleta as campanhas do Google Ads no período e faz upsert por dia. */
export async function pullGoogleAds(range: PullRange): Promise<number> {
  const { adsCustomerId } = await getGoogleConfig();
  if (!adsCustomerId) throw new Error("Conta do Google Ads (customer id) não configurada");
  const rows = await getCampaignMetrics(adsCustomerId, range);
  return upsertDayInsights("google", adsCustomerId, rows);
}

/** Coleta as sessões do GA4 no período e faz upsert por dia/origem/mídia. */
export async function pullGa4(range: PullRange): Promise<number> {
  const { ga4PropertyId } = await getGoogleConfig();
  if (!ga4PropertyId) throw new Error("GA4 Property ID não configurado");
  const rows = await getSessionMetrics(ga4PropertyId, range);
  return upsertGa4Rows(rows);
}
