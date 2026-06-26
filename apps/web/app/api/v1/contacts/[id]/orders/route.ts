import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const orders = await prisma.order.findMany({
    where: { contactId: id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    data: orders.map((o) => ({
      id: o.id,
      external_id: o.externalId,
      status: o.status,
      total: Number(o.total),
      created_at: o.createdAt.toISOString(),
      items: o.items ?? [],
      tracking: o.tracking,
      carrier: o.carrier,
      tracking_url: o.trackingUrl,
    })),
  });
}
