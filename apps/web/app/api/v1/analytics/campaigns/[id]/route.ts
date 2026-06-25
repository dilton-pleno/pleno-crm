import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { parseRange, dec } from "@/lib/analytics-query";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const range = parseRange(request.nextUrl.searchParams);

  const rows = await prisma.campaignMetric.findMany({
    where: { campaignId: id, date: { gte: range.start, lte: range.end } },
    orderBy: { date: "asc" },
  });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Campanha sem dados no período" } },
      { status: 404 }
    );
  }

  const first = rows[0]!;

  return NextResponse.json({
    data: {
      campaign_id: id,
      name: first.campaignName,
      platform: first.platform,
      status: rows[rows.length - 1]!.status,
      history: rows.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        impressions: r.impressions,
        reach: r.reach,
        clicks: r.clicks,
        spend: dec(r.spend),
        cpm: dec(r.cpm),
        ctr: dec(r.ctr),
        roas: dec(r.roas),
        conversions: r.conversions,
      })),
    },
  });
}
