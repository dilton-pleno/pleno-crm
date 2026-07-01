import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { resolveEcommerceStoreId } from "@/lib/store-integration";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
  const storeId = await resolveEcommerceStoreId(params.get("store"));
  const where = { storeIntegrationId: storeId };

  const [reviews, total, avg] = await Promise.all([
    prisma.wbuyReview.findMany({
      where,
      orderBy: { reviewDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.wbuyReview.count({ where }),
    prisma.wbuyReview.aggregate({ where, _avg: { rating: true } }),
  ]);

  return NextResponse.json({
    data: reviews.map((r) => ({
      id: r.id,
      product_name: r.productName,
      customer_name: r.customerName,
      rating: r.rating,
      comment: r.comment,
      approved: r.approved,
      review_date: r.reviewDate?.toISOString() ?? null,
    })),
    meta: { total, page, limit, avg_rating: avg._avg.rating ?? 0 },
  });
}
