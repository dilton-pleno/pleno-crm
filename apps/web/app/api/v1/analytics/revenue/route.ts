import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { parseRange, dec, storeFilter } from "@/lib/analytics-query";

// Faturamento (Wbuy) por período, para cruzar com investimento em ads.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const range = parseRange(request.nextUrl.searchParams);

  const agg = await prisma.order.aggregate({
    where: {
      createdAt: { gte: range.start, lte: range.end },
      ...storeFilter(request.nextUrl.searchParams),
    },
    _sum: { total: true },
    _count: { id: true },
  });

  return NextResponse.json({
    data: {
      period: { start: range.startStr, end: range.endStr },
      total_revenue: agg._sum.total ? dec(agg._sum.total) : 0,
      order_count: agg._count.id,
    },
  });
}
