import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/analytics-query";
import { resolveEcommerceStoreId } from "@/lib/store-integration";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
  const search = params.get("search")?.trim();
  const storeId = await resolveEcommerceStoreId(params.get("store"));

  const where: Prisma.OrderWhereInput = {
    storeIntegrationId: storeId,
    ...(search
      ? {
          OR: [
            { externalId: { contains: search } },
            { contact: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { contact: { select: { id: true, name: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    data: orders.map((o) => ({
      id: o.id,
      external_id: o.externalId,
      contact_id: o.contact.id,
      contact_name: o.contact.name,
      status: o.status,
      total: dec(o.total),
      created_at: o.createdAt.toISOString(),
      tracking: o.tracking,
      carrier: o.carrier,
      tracking_url: o.trackingUrl,
    })),
    meta: { total, page, limit },
  });
}
