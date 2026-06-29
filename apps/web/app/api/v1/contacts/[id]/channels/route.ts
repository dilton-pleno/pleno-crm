import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { requireContactAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";
import { getDefaultInboxId } from "@/lib/inbox-routing";

const schema = z.object({
  channel_type: z.enum(["whatsapp", "instagram", "messenger", "email", "site"]),
  channel_identifier: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const access = await requireContactAccess(guard.session, id);
  if (!access.ok) return access.response;

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Contato não encontrado" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { channel_type, channel_identifier, metadata } = parsed.data;

  // Verify the identifier isn't already linked to another contact
  const existing = await prisma.contactChannel.findUnique({
    where: {
      channelType_channelIdentifier: {
        channelType: channel_type,
        channelIdentifier: channel_identifier,
      },
    },
    include: { contact: { select: { id: true, name: true } } },
  });

  if (existing && existing.contactId !== id) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: `Identificador já vinculado ao contato "${existing.contact.name}"`,
        },
      },
      { status: 409 }
    );
  }

  if (existing && existing.contactId === id) {
    return NextResponse.json({ data: existing }, { status: 200 });
  }

  const channel = await prisma.contactChannel.create({
    data: {
      contactId: id,
      channelType: channel_type,
      channelIdentifier: channel_identifier,
      inboxId: await getDefaultInboxId(),
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json({ data: channel }, { status: 201 });
}
