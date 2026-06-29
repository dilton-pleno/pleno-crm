// Cliente da Google Analytics 4 Data API. PENDENTE de validação com
// credenciais reais (OAuth + property). Ainda não exercitado em runtime.

import type { DateRange } from "@/lib/meta-ads";
import { getGoogleAccessToken } from "@/lib/google-config";

export interface Ga4Row {
  date: string;
  source: string | null;
  medium: string | null;
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
}

interface RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
}

/**
 * Busca métricas de sessões/usuários por dia e origem/mídia no período.
 */
export async function getSessionMetrics(
  propertyId: string,
  range: DateRange
): Promise<Ga4Row[]> {
  const token = await getGoogleAccessToken();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: range.start, endDate: range.end }],
        dimensions: [{ name: "date" }, { name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
        ],
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GA4 runReport falhou [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as RunReportResponse;
  return (json.rows ?? []).map((row) => {
    const dims = row.dimensionValues ?? [];
    const mets = row.metricValues ?? [];
    const rawDate = dims[0]?.value ?? ""; // YYYYMMDD
    const date =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
    return {
      date,
      source: dims[1]?.value ?? null,
      medium: dims[2]?.value ?? null,
      sessions: Number(mets[0]?.value ?? 0),
      users: Number(mets[1]?.value ?? 0),
      pageviews: Number(mets[2]?.value ?? 0),
      bounceRate: Number(mets[3]?.value ?? 0),
    };
  });
}
