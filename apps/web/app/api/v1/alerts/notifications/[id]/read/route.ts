import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const exists = await prisma.alertNotification.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Notificação não encontrada" } },
      { status: 404 }
    );
  }

  await prisma.alertNotification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ data: { id, read: true } });
}
