// Cliente da Google Ads API. PENDENTE de validação com credenciais reais
// (developer token aprovado + OAuth refresh token). Ainda não exercitado.

import type { CampaignInsight, DateRange } from "@/lib/meta-ads";

const API_VERSION = "v17";

interface GoogleAdsRow {
  campaign?: { id?: string; name?: string; status?: string };
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

async function accessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais OAuth do Google Ads não configuradas");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google OAuth falhou [${res.status}]`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/**
 * Busca métricas de campanhas via GAQL no período informado.
 */
export async function getCampaignMetrics(
  customerId: string,
  range: DateRange
): Promise<CampaignInsight[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN não configurado");

  const token = await accessToken();
  const query =
    `SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, ` +
    `metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.average_cpm, ` +
    `metrics.conversions, metrics.conversions_value FROM campaign ` +
    `WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'`;

  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:searchStream`,
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
