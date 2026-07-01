// Cliente da Google Ads API. PENDENTE de validação com credenciais reais
// (developer token aprovado + OAuth refresh token). Ainda não exercitado.

import type { CampaignDayInsight, DateRange } from "@/lib/meta-ads";
import { getGoogleAccessToken, getGoogleConfig } from "@/lib/google-config";

const API_VERSION = "v17";

interface GoogleAdsRow {
  campaign?: { id?: string; name?: string; status?: string };
  segments?: { date?: string };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    ctr?: number;
    averageCpm?: string;
    conversions?: number;
    conversionsValue?: number;
  };
}

/**
 * Busca métricas DIÁRIAS de campanhas via GAQL no período (`segments.date` no
 * SELECT → uma linha por campanha por dia).
 */
export async function getCampaignMetrics(
  customerId: string,
  range: DateRange
): Promise<CampaignDayInsight[]> {
  const { adsDeveloperToken: developerToken } = await getGoogleConfig();
  if (!developerToken) throw new Error("Developer token do Google Ads não configurado");

  // A API exige o customer id só com dígitos (sem traços).
  const cid = customerId.replace(/\D/g, "");
  const token = await getGoogleAccessToken();
  const query =
    `SELECT campaign.id, campaign.name, campaign.status, segments.date, ` +
    `metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, ` +
    `metrics.average_cpm, metrics.conversions, metrics.conversions_value ` +
    `FROM campaign WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'`;

  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Ads searchStream falhou [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as Array<{ results?: GoogleAdsRow[] }>;
  const rows = json.flatMap((batch) => batch.results ?? []);

  return rows.map((row) => {
    const spend = Number(row.metrics?.costMicros ?? 0) / 1_000_000;
    const value = Number(row.metrics?.conversionsValue ?? 0);
    return {
      date: row.segments?.date ?? range.start,
      id: row.campaign?.id ?? "",
      name: row.campaign?.name ?? "",
      status: row.campaign?.status ?? null,
      impressions: Number(row.metrics?.impressions ?? 0),
      reach: 0, // Google Ads não expõe reach por campanha de forma direta
      clicks: Number(row.metrics?.clicks ?? 0),
      spend,
      cpm: Number(row.metrics?.averageCpm ?? 0) / 1_000_000,
      ctr: Number(row.metrics?.ctr ?? 0) * 100,
      roas: spend > 0 ? value / spend : 0,
      conversions: Math.round(Number(row.metrics?.conversions ?? 0)),
    };
  });
}
