// Cliente da Meta Ads API (Marketing API). Usado pela camada de sincronização
// para buscar insights de campanhas. PENDENTE de validação com credenciais
// reais (token de longa duração + ad account) — ainda não exercitado em runtime.

import { getMetaAdsConfig } from "@/lib/meta-ads-config";

const GRAPH_VERSION = "v21.0";

export interface DateRange {
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
}

export interface CampaignInsight {
  id: string;
  name: string;
  status: string | null;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  cpm: number;
  ctr: number;
  roas: number;
  conversions: number;
}

/** Insight de uma campanha em UM dia (para série diária + upsert idempotente). */
export interface CampaignDayInsight extends CampaignInsight {
  /** YYYY-MM-DD */
  date: string;
}

interface MetaInsight {
  date_start?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

interface MetaCampaign {
  id: string;
  name: string;
  status?: string;
  insights?: { data?: MetaInsight[] };
}

async function token(): Promise<string> {
  const { accessToken } = await getMetaAdsConfig();
  if (!accessToken) throw new Error("Access token de anúncios da Meta não configurado");
  return accessToken;
}

/** Testa a conexão de anúncios: busca o nome da conta de anúncios. */
export async function testMetaAdsConnection(): Promise<{ accountName: string }> {
  const { accessToken, adAccountId } = await getMetaAdsConfig();
  if (!accessToken || !adAccountId) throw new Error("Credenciais de anúncios incompletas");
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${adAccountId}?fields=name&access_token=${accessToken}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Ads teste falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { name?: string };
  return { accountName: json.name ?? "(sem nome)" };
}

function num(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Busca insights DIÁRIOS de campanhas de uma ad account no período informado
 * (`time_increment(1)` → uma linha por campanha por dia). Conversões e ROAS são
 * derivados de `actions`/`action_values` (purchase).
 */
export async function getCampaignInsights(
  accountId: string,
  range: DateRange
): Promise<CampaignDayInsight[]> {
  const timeRange = encodeURIComponent(JSON.stringify({ since: range.start, until: range.end }));
  const fields =
    `name,status,insights.time_range(${timeRange}).time_increment(1)` +
    `{impressions,reach,clicks,spend,cpm,ctr,actions,action_values,date_start}`;
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${accountId}/campaigns` +
    `?fields=${fields}&limit=500&access_token=${await token()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Ads insights falhou [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as { data?: MetaCampaign[] };
  const campaigns = json.data ?? [];

  const rows: CampaignDayInsight[] = [];
  for (const c of campaigns) {
    for (const insight of c.insights?.data ?? []) {
      const spend = num(insight.spend);
      const purchaseValue = num(
        insight.action_values?.find((a) => a.action_type === "purchase")?.value
      );
      const conversions = num(
        insight.actions?.find((a) => a.action_type === "purchase")?.value
      );
      rows.push({
        date: insight.date_start ?? range.start,
        id: c.id,
        name: c.name,
        status: c.status ?? null,
        impressions: num(insight.impressions),
        reach: num(insight.reach),
        clicks: num(insight.clicks),
        spend,
        cpm: num(insight.cpm),
        ctr: num(insight.ctr),
        roas: spend > 0 ? purchaseValue / spend : 0,
        conversions,
      });
    }
  }
  return rows;
}
