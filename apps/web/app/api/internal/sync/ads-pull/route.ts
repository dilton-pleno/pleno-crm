import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { rangeFromDays, pullMetaAds, pullGoogleAds, pullGa4 } from "@/lib/ads-pull";
import { getMetaAdsConfig } from "@/lib/meta-ads-config";
import { getGoogleConfig } from "@/lib/google-config";

// Cron diário (N8N): coleta as métricas reais das plataformas de anúncio que
// estiverem configuradas. Reprocessa uma janela (default 7 dias) para capturar
// conversões/ROAS atribuídos com atraso. Cada plataforma é isolada — se uma
// falhar (ex.: Google Ads ainda sem Basic access), as outras seguem.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const daysParam = parseInt(request.nextUrl.searchParams.get("days") ?? "7", 10);
  const days = Number.isFinite(daysParam) ? Math.min(90, Math.max(1, daysParam)) : 7;
  const range = rangeFromDays(days);

  const results: Record<string, number | string> = {};
  const errMsg = (e: unknown) => (e instanceof Error ? e.message : "erro");

  const meta = await getMetaAdsConfig();
  if (meta.adAccountId) {
    try {
      results.meta = await pullMetaAds(range);
    } catch (e) {
      console.error("[internal/ads-pull] meta:", e);
      results.meta = errMsg(e);
    }
  }

  const google = await getGoogleConfig();
  if (google.adsCustomerId) {
    try {
      results.google = await pullGoogleAds(range);
    } catch (e) {
      console.error("[internal/ads-pull] google:", e);
      results.google = errMsg(e);
    }
  }
  if (google.ga4PropertyId) {
    try {
      results.ga4 = await pullGa4(range);
    } catch (e) {
      console.error("[internal/ads-pull] ga4:", e);
      results.ga4 = errMsg(e);
    }
  }

  return NextResponse.json({
    data: { period: { start: range.start, end: range.end }, results },
  });
}
