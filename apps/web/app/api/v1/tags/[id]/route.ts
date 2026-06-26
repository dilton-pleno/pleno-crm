import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// Renomeia / muda a cor (ADMIN/GESTOR).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  await prisma.tag.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
    },
  });
  return NextResponse.json({ data: { id } });
}

// Exclui a etiqueta (ADMIN/GESTOR). Os vínculos com contatos saem junto (m2m).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
