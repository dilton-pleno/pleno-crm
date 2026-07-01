import { NextRequest, NextResponse } from "next/server";
import type { AdPlatform } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  parseRange,
  aggregateByCampaign,
  storeFilter,
  type CampaignAgg,
  type CampaignAggRow,
} from "@/lib/analytics-query";

const SORTABLE = [
  "name",
  "platform",
  "status",
  "spend",
  "reach",
  "clicks",
  "ctr",
  "roas",
] as const;
type SortKey = (typeof SORTABLE)[number];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const range = parseRange(params);

  const platformParam = params.get("platform");
  const platform: AdPlatform | undefined =
    platformParam === "meta" || platformParam === "google" ? platformParam : undefined;

  const sortParam = params.get("sort") as SortKey | null;
  const sort: SortKey = sortParam && SORTABLE.includes(sortParam) ? sortParam : "spend";
  const order = params.get("order") === "asc" ? "asc" : "desc";

  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));

  const rows = await prisma.campaignMetric.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      ...(platform ? { platform } : {}),
      ...storeFilter(params),
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

  const aggregated = aggregateByCampaign(rows as CampaignAggRow[]);

  aggregated.sort((a, b) => {
    const av = a[sort as keyof CampaignAgg];
    const bv = b[sort as keyof CampaignAgg];
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av ?? "").localeCompare(String(bv ?? ""));
    }
    return order === "asc" ? cmp : -cmp;
  });

  const total = aggregated.length;
  const paged = aggregated.slice((page - 1) * limit, (page - 1) * limit + limit);

  return NextResponse.json({
    data: paged,
    meta: { total, page, limit },
  });
}
