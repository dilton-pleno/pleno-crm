import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/analytics-query";
import { resolveEcommerceStoreId } from "@/lib/store-integration";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const storeId = await resolveEcommerceStoreId(request.nextUrl.searchParams.get("store"));
  const last30 = new Date(Date.now() - 30 * 86400000);

  const [agg30, totalCount, recovered, recent] = await Promise.all([
    prisma.abandonedCart.aggregate({
      where: { storeIntegrationId: storeId, createdAt: { gte: last30 } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.abandonedCart.count({ where: { storeIntegrationId: storeId } }),
    prisma.abandonedCart.count({ where: { storeIntegrationId: storeId, recovered: true } }),
    prisma.abandonedCart.findMany({
      where: { storeIntegrationId: storeId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return NextResponse.json({
    data: {
      count_30d: agg30._count.id,
      value_30d: agg30._sum.total ? dec(agg30._sum.total) : 0,
      total_count: totalCount,
      recovered_count: recovered,
      recent: recent.map((c) => ({
        id: c.id,
        customer_name: c.customerName,
        customer_email: c.customerEmail,
        items_count: c.itemsCount,
        total: dec(c.total),
        created_at: c.createdAt.toISOString(),
      })),
    },
  });
}
