import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { campaignSyncSchema, upsertCampaignMetrics } from "@/lib/analytics-sync";

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

  const count = await upsertCampaignMetrics(
    "google",
    parsed.data,
    process.env.GOOGLE_ADS_CUSTOMER_ID ?? "unknown"
  );

  return NextResponse.json({ data: { synced: count, upserted: count } });
}
