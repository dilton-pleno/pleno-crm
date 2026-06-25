import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/analytics-query";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const last30 = new Date(Date.now() - 30 * 86400000);

  const [agg30, totalCount, recovered, recent] = await Promise.all([
    prisma.abandonedCart.aggregate({
      where: { createdAt: { gte: last30 } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.abandonedCart.count(),
    prisma.abandonedCart.count({ where: { recovered: true } }),
    prisma.abandonedCart.findMany({
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
