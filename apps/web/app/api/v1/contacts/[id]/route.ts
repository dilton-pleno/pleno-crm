import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.email !== undefined ||
      d.phone !== undefined ||
      d.notes !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  );

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      channels: { select: { id: true, channelType: true, channelIdentifier: true } },
      tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
    },
  });

  if (!contact) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Contato não encontrado" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      avatarUrl: contact.avatarUrl,
      notes: contact.notes,
      channels: contact.channels,
      tags: contact.tags,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Contato não encontrado" } },
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

  const { name, email, phone, notes } = parsed.data;
  const updated = await prisma.contact.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      notes: updated.notes,
    },
  });
}
