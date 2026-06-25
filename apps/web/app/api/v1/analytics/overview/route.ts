import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  parseRange,
  previousRange,
  summarize,
  changePct,
  dec,
  type CampaignRow,
} from "@/lib/analytics-query";

const SELECT = {
  spend: true,
  reach: true,
  clicks: true,
  impressions: true,
  cpm: true,
  ctr: true,
  roas: true,
  conversions: true,
} as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const range = parseRange(request.nextUrl.searchParams);
  const compare = request.nextUrl.searchParams.get("compare") === "true";

  const rows = await prisma.campaignMetric.findMany({
    where: { date: { gte: range.start, lte: range.end } },
    select: { ...SELECT, platform: true, date: true },
  });

  const summary = summarize(rows as CampaignRow[]);

  // Quebra por plataforma + série diária de investimento (Meta vs Google).
  const byPlatform = { meta: { spend: 0, reach: 0 }, google: { spend: 0, reach: 0 } };
  const seriesMap = new Map<string, { date: string; meta: number; google: number }>();
  for (const r of rows) {
    const bucket = byPlatform[r.platform];
    const spend = dec(r.spend);
    bucket.spend += spend;
    bucket.reach += r.reach;

    const day = r.date.toISOString().slice(0, 10);
    const entry = seriesMap.get(day) ?? { date: day, meta: 0, google: 0 };
    entry[r.platform] += spend;
    seriesMap.set(day, entry);
  }
  byPlatform.meta.spend = Math.round(byPlatform.meta.spend * 100) / 100;
  byPlatform.google.spend = Math.round(byPlatform.google.spend * 100) / 100;

  const series = Array.from(seriesMap.values())
    .map((e) => ({
      date: e.date,
      meta: Math.round(e.meta * 100) / 100,
      google: Math.round(e.google * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let comparison: {
    spend_change_pct: number;
    reach_change_pct: number;
    clicks_change_pct: number;
  } | null = null;

  if (compare) {
    const prev = previousRange(range);
    const prevRows = await prisma.campaignMetric.findMany({
      where: { date: { gte: prev.start, lte: prev.end } },
      select: SELECT,
    });
    const prevSummary = summarize(prevRows as CampaignRow[]);
    comparison = {
      spend_change_pct: changePct(summary.total_spend, prevSummary.total_spend),
      reach_change_pct: changePct(summary.total_reach, prevSummary.total_reach),
      clicks_change_pct: changePct(summary.total_clicks, prevSummary.total_clicks),
    };
  }

  return NextResponse.json({
    data: {
      period: { start: range.startStr, end: range.endStr },
      metrics: {
        total_spend: summary.total_spend,
        total_reach: summary.total_reach,
        total_clicks: summary.total_clicks,
        avg_cpm: summary.avg_cpm,
        avg_ctr: summary.avg_ctr,
        avg_roas: summary.avg_roas,
      },
      comparison,
      by_platform: byPlatform,
      series,
    },
  });
}
