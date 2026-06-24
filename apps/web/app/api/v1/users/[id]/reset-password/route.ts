import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/password";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Usuário não encontrado" } },
      { status: 404 }
    );
  }

  const password = generatePassword(12);
  const passwordHash = await hash(password, 12);

  await prisma.user.update({ where: { id }, data: { passwordHash } });

  // A senha em texto claro é retornada uma única vez para o admin copiar.
  return NextResponse.json({ data: { id, password } });
}
