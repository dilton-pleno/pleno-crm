import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isPasswordValid } from "@/lib/password";

const schema = z.object({
  password: z
    .string()
    .refine(isPasswordValid, "A senha deve ter 8+ caracteres com maiúscula, minúscula, número e símbolo"),
});

export async function POST(
  request: NextRequest,
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

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  return NextResponse.json({ data: { id } });
}
