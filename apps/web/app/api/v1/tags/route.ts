import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess, requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// Lista as etiquetas (qualquer um com acesso a contatos/atendimento).
export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("contatos");
  if (!guard.ok) return guard.response;

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });

  return NextResponse.json({
    data: tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      contact_count: t._count.contacts,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// Cria uma etiqueta (ADMIN/GESTOR).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const name = parsed.data.name.trim();
  const existing = await prisma.tag.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Já existe uma etiqueta com esse nome" } },
      { status: 409 }
    );
  }

  const tag = await prisma.tag.create({
    data: { name, color: parsed.data.color ?? "#6366f1" },
  });
  return NextResponse.json({ data: { id: tag.id, name: tag.name, color: tag.color } });
}
