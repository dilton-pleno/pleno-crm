import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { parseRange, storeFilter } from "@/lib/analytics-query";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const range = parseRange(request.nextUrl.searchParams);

  const rows = await prisma.ga4Metric.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      ...storeFilter(request.nextUrl.searchParams),
    },
    orderBy: { date: "asc" },
  });

  // Consolida por dia (somando origens/mídias).
  const byDay = new Map<string, { date: string; sessions: number; users: number; pageviews: number }>();
  let totalSessions = 0;
  let totalUsers = 0;
  let totalPageviews = 0;

  for (const r of rows) {
    const day = r.date.toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { date: day, sessions: 0, users: 0, pageviews: 0 };
    entry.sessions += r.sessions;
    entry.users += r.users;
    entry.pageviews += r.pageviews;
    byDay.set(day, entry);
    totalSessions += r.sessions;
    totalUsers += r.users;
    totalPageviews += r.pageviews;
  }

  return NextResponse.json({
    data: {
      period: { start: range.startStr, end: range.endStr },
      totals: { sessions: totalSessions, users: totalUsers, pageviews: totalPageviews },
      series: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    },
  });
}
