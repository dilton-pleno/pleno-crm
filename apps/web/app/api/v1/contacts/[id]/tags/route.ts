import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ tag_id: z.string().uuid() });

// Vincula uma etiqueta ao contato (quem edita contatos: ADMIN/GESTOR).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  await prisma.contact.update({
    where: { id },
    data: { tags: { connect: { id: parsed.data.tag_id } } },
  });
  return NextResponse.json({ data: { contact_id: id, tag_id: parsed.data.tag_id } });
}

// Desvincula uma etiqueta do contato.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const tagId = request.nextUrl.searchParams.get("tag_id");
  if (!tagId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "tag_id é obrigatório" } },
      { status: 422 }
    );
  }

  await prisma.contact.update({
    where: { id },
    data: { tags: { disconnect: { id: tagId } } },
  });
  return NextResponse.json({ data: { contact_id: id, tag_id: tagId } });
}
