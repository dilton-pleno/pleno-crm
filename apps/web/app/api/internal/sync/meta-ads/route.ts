import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { campaignSyncSchema, upsertCampaignMetrics } from "@/lib/analytics-sync";
import { getMetaAdsConfig } from "@/lib/meta-ads-config";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = campaignSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { adAccountId } = await getMetaAdsConfig();
  const count = await upsertCampaignMetrics("meta", parsed.data, adAccountId ?? "unknown");

  return NextResponse.json({ data: { synced: count, upserted: count } });
}
