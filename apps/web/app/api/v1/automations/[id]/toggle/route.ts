import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("automacoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const automation = await prisma.automation.findUnique({ where: { id }, select: { active: true } });
  if (!automation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Automação não encontrada" } },
      { status: 404 }
    );
  }

  const updated = await prisma.automation.update({
    where: { id },
    data: { active: !automation.active },
    select: { id: true, active: true },
  });
  return NextResponse.json({ data: { id: updated.id, active: updated.active } });
}
