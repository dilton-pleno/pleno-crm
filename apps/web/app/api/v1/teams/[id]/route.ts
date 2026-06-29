import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess, requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isTeamManager } from "@/lib/visibility";

const patchSchema = z.object({ name: z.string().min(1).max(60) });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!(await isTeamManager(guard.session.user, id))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Apenas o gestor do time ou um Admin pode alterá-lo" } },
      { status: 403 }
    );
  }
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const team = await prisma.team.update({
    where: { id },
    data: { name: parsed.data.name.trim() },
  });
  return NextResponse.json({ data: { id: team.id, name: team.name } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Excluir time é exclusivo do ADMIN.
  const guard = await requireRoles(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  // Cascata remove membros/vínculos (onDelete: Cascade nos joins).
  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
