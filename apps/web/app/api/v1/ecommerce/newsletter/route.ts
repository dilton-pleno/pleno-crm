import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
  const search = params.get("search")?.trim();

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [subs, total, active] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { signupDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.count({ where: { subscribed: true } }),
  ]);

  return NextResponse.json({
    data: subs.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      subscribed: s.subscribed,
      signup_date: s.signupDate?.toISOString() ?? null,
    })),
    meta: { total, page, limit, active },
  });
}
