import type { Prisma } from "@prisma/client";

export interface Range {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Lê start/end de query params (YYYY-MM-DD). Default: últimos 7 dias.
 * As datas são tratadas em UTC para casar com `@db.Date`.
 */
export function parseRange(params: URLSearchParams): Range {
  const today = new Date();
  const defaultEnd = toDateOnly(today);
  const defaultStart = toDateOnly(new Date(today.getTime() - 6 * 86400000));

  const startStr = params.get("start") ?? defaultStart;
  const endStr = params.get("end") ?? defaultEnd;

  return {
    start: new Date(`${startStr}T00:00:00.000Z`),
    end: new Date(`${endStr}T23:59:59.999Z`),
    startStr,
    endStr,
  };
}

/**
 * Período imediatamente anterior, de mesma duração, para comparação.
 */
export function previousRange(range: Range): { start: Date; end: Date } {
  const days =
    Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(range.start.getTime() - days * 86400000);
  return { start: prevStart, end: prevEnd };
}

export function dec(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

export interface CampaignRow {
  spend: Prisma.Decimal;
  reach: number;
  clicks: number;
  impressions: number;
  cpm: Prisma.Decimal;
  ctr: Prisma.Decimal;
  roas: Prisma.Decimal;
  conversions: number;
}

export interface Summary {
  total_spend: number;
  total_reach: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  avg_cpm: number;
  avg_ctr: number;
  avg_roas: number;
}

/**
 * Consolida métricas a partir das linhas diárias. CPM/CTR/ROAS são derivados
 * dos totais (ponderados), não médias simples — refletem melhor o agregado.
 */
export function summarize(rows: CampaignRow[]): Summary {
  let spend = 0;
  let reach = 0;
  let clicks = 0;
  let impressions = 0;
  let conversions = 0;
  let revenue = 0; // roas * spend por linha → receita estimada

  for (const r of rows) {
    const s = dec(r.spend);
    spend += s;
    reach += r.reach;
    clicks += r.clicks;
    impressions += r.impressions;
    conversions += r.conversions;
    revenue += dec(r.roas) * s;
  }

  return {
    total_spend: round2(spend),
    total_reach: reach,
    total_clicks: clicks,
    total_impressions: impressions,
    total_conversions: conversions,
    avg_cpm: impressions > 0 ? round2((spend / impressions) * 1000) : 0,
    avg_ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
    avg_roas: spend > 0 ? round2(revenue / spend) : 0,
  };
}

export interface CampaignAggRow extends CampaignRow {
  platform: "meta" | "google";
  campaignId: string;
  campaignName: string;
  status: string | null;
}

export interface CampaignAgg {
  campaign_id: string;
  name: string;
  platform: "meta" | "google";
  status: string | null;
  spend: number;
  reach: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpm: number;
  ctr: number;
  roas: number;
}

/**
 * Agrega as linhas diárias por campanha no período, com CPM/CTR/ROAS derivados
 * dos totais.
 */
export function aggregateByCampaign(rows: CampaignAggRow[]): CampaignAgg[] {
  const map = new Map<
    string,
    CampaignAgg & { _impr: number; _revenue: number }
  >();

  for (const r of rows) {
    const existing =
      map.get(r.campaignId) ??
      {
        campaign_id: r.campaignId,
        name: r.campaignName,
        platform: r.platform,
        status: r.status,
        spend: 0,
        reach: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        cpm: 0,
        ctr: 0,
        roas: 0,
        _impr: 0,
        _revenue: 0,
      };
    const s = dec(r.spend);
    existing.spend += s;
    existing.reach += r.reach;
    existing.clicks += r.clicks;
    existing.impressions += r.impressions;
    existing.conversions += r.conversions;
    existing._impr += r.impressions;
    existing._revenue += dec(r.roas) * s;
    existing.name = r.campaignName;
    existing.status = r.status;
    map.set(r.campaignId, existing);
  }

  return Array.from(map.values()).map((c) => ({
    campaign_id: c.campaign_id,
    name: c.name,
    platform: c.platform,
    status: c.status,
    spend: Math.round(c.spend * 100) / 100,
    reach: c.reach,
    clicks: c.clicks,
    impressions: c.impressions,
    conversions: c.conversions,
    cpm: c._impr > 0 ? Math.round((c.spend / c._impr) * 1000 * 100) / 100 : 0,
    ctr: c._impr > 0 ? Math.round((c.clicks / c._impr) * 100 * 100) / 100 : 0,
    roas: c.spend > 0 ? Math.round((c._revenue / c.spend) * 100) / 100 : 0,
  }));
}

export function changePct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return round2(((current - previous) / previous) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
