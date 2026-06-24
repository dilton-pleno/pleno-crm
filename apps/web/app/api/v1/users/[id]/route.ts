import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(["ADMIN", "GESTOR", "ATENDENTE"]).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.email !== undefined ||
      d.role !== undefined ||
      d.active !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Usuário não encontrado" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { name, email, role, active } = parsed.data;

  // Regras de proteção da própria conta do admin.
  if (id === session.user.id) {
    if (role !== undefined && role !== target.role) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Não é possível alterar a própria role" } },
        { status: 403 }
      );
    }
    if (active === false) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Não é possível desativar a própria conta" } },
        { status: 403 }
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(active !== undefined ? { active } : {}),
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: { code: "EMAIL_TAKEN", message: "Já existe um usuário com este e-mail" } },
        { status: 409 }
      );
    }
    console.error("[users] Erro ao atualizar usuário:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Falha ao atualizar usuário" } },
      { status: 500 }
    );
  }
}
