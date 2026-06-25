import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/analytics-query";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const last30 = new Date(Date.now() - 30 * 86400000);

  const [agg, totalCount, recent] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: last30 } },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.order.count(),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { contact: { select: { id: true, name: true } } },
    }),
  ]);

  return NextResponse.json({
    data: {
      revenue_30d: agg._sum.total ? dec(agg._sum.total) : 0,
      orders_30d: agg._count.id,
      total_orders: totalCount,
      recent: recent.map((o) => ({
        id: o.id,
        external_id: o.externalId,
        contact_id: o.contact.id,
        contact_name: o.contact.name,
        status: o.status,
        total: dec(o.total),
        created_at: o.createdAt.toISOString(),
      })),
    },
  });
}
