import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  // Por padrão lista só as não lidas; ?all=true traz todas.
  const all = request.nextUrl.searchParams.get("all") === "true";

  const notifications = await prisma.alertNotification.findMany({
    where: all ? {} : { readAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { alert: { select: { name: true } } },
  });

  return NextResponse.json({
    data: notifications.map((n) => ({
      id: n.id,
      alert_id: n.alertId,
      alert_name: n.alert.name,
      message: n.message,
      read_at: n.readAt?.toISOString() ?? null,
      created_at: n.createdAt.toISOString(),
    })),
  });
}
