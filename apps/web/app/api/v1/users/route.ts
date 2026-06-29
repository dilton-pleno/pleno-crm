import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isPasswordValid } from "@/lib/password";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z
    .string()
    .refine(isPasswordValid, "A senha deve ter 8+ caracteres com maiúscula, minúscula, número e símbolo"),
  role: z.enum(["ADMIN", "GESTOR", "ATENDENTE"]),
  active: z.boolean().optional().default(true),
});

export async function GET(): Promise<NextResponse> {
  // Configurações é restrito a Admin (matriz de permissões).
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { name, email, password, role, active } = parsed.data;
  const passwordHash = await hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, active },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
    return NextResponse.json({ data: user }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: { code: "EMAIL_TAKEN", message: "Já existe um usuário com este e-mail" } },
        { status: 409 }
      );
    }
    console.error("[users] Erro ao criar usuário:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Falha ao criar usuário" } },
      { status: 500 }
    );
  }
}
