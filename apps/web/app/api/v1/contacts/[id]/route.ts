import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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
    },
  });
}
