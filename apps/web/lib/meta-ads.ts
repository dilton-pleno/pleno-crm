// Cliente da Meta Ads API (Marketing API). Usado pela camada de sincronização
// para buscar insights de campanhas. PENDENTE de validação com credenciais
// reais (token de longa duração + ad account) — ainda não exercitado em runtime.

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

interface MetaInsight {
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

function token(): string {
  const t = process.env.META_ACCESS_TOKEN;
  if (!t) throw new Error("META_ACCESS_TOKEN não configurada");
  return t;
}

function num(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Busca insights de campanhas de uma ad account no período informado.
 * Conversões e ROAS são derivados de `actions`/`action_values` (purchase).
 */
export async function getCampaignInsights(
  accountId: string,
  range: DateRange
): Promise<CampaignInsight[]> {
  const timeRange = encodeURIComponent(JSON.stringify({ since: range.start, until: range.end }));
  const fields =
    `name,status,insights.time_range(${timeRange})` +
    `{impressions,reach,clicks,spend,cpm,ctr,actions,action_values}`;
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/act_${accountId}/campaigns` +
    `?fields=${fields}&access_token=${token()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Ads insights falhou [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as { data?: MetaCampaign[] };
  const campaigns = json.data ?? [];

  return campaigns.map((c) => {
    const insight = c.insights?.data?.[0];
    const spend = num(insight?.spend);
    const purchaseValue = num(
      insight?.action_values?.find((a) => a.action_type === "purchase")?.value
    );
    const conversions = num(
      insight?.actions?.find((a) => a.action_type === "purchase")?.value
    );
    return {
      id: c.id,
      name: c.name,
      status: c.status ?? null,
      impressions: num(insight?.impressions),
      reach: num(insight?.reach),
      clicks: num(insight?.clicks),
      spend,
      cpm: num(insight?.cpm),
      ctr: num(insight?.ctr),
      roas: spend > 0 ? purchaseValue / spend : 0,
      conversions,
    };
  });
}
