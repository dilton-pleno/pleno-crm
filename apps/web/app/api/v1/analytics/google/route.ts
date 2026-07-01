import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  parseRange,
  summarize,
  aggregateByCampaign,
  storeFilter,
  type CampaignRow,
  type CampaignAggRow,
} from "@/lib/analytics-query";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const range = parseRange(request.nextUrl.searchParams);

  const rows = await prisma.campaignMetric.findMany({
    where: {
      platform: "google",
      date: { gte: range.start, lte: range.end },
      ...storeFilter(request.nextUrl.searchParams),
    },
    select: {
      platform: true,
      campaignId: true,
      campaignName: true,
      status: true,
      spend: true,
      reach: true,
      clicks: true,
      impressions: true,
      cpm: true,
      ctr: true,
      roas: true,
      conversions: true,
    },
  });

  const summary = summarize(rows as CampaignRow[]);
  const campaigns = aggregateByCampaign(rows as CampaignAggRow[]);

  return NextResponse.json({
    data: {
      period: { start: range.startStr, end: range.endStr },
      metrics: summary,
      campaigns,
    },
  });
}
