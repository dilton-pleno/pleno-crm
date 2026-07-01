import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_INBOX_ID } from "@/lib/inbox-routing";

const withIntegrations = {
  whatsappIntegration: { select: { id: true, name: true, provider: true } },
  metaIntegration: { select: { id: true, name: true } },
} as const;

function serialize(i: Prisma.InboxGetPayload<{ include: typeof withIntegrations }>) {
  return {
    id: i.id,
    name: i.name,
    active: i.active,
    is_default: i.id === DEFAULT_INBOX_ID,
    whatsapp_integration: i.whatsappIntegration
      ? { id: i.whatsappIntegration.id, name: i.whatsappIntegration.name, provider: i.whatsappIntegration.provider }
      : null,
    meta_integration: i.metaIntegration ? { id: i.metaIntegration.id, name: i.metaIntegration.name } : null,
  };
}

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  active: z.boolean().optional(),
  // string uuid = vincular; null = desvincular; ausente = manter.
  whatsapp_integration_id: z.string().uuid().nullable().optional(),
  meta_integration_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const inbox = await prisma.inbox.findUnique({ where: { id }, select: { id: true } });
  if (!inbox) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Canal não encontrado" } }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 422 });
  }
  const d = parsed.data;

  try {
    const updated = await prisma.inbox.update({
      where: { id },
      data: {
        name: d.name?.trim(),
        active: d.active,
        whatsappIntegrationId: d.whatsapp_integration_id,
        metaIntegrationId: d.meta_integration_id,
      },
      include: withIntegrations,
    });
    return NextResponse.json({ data: serialize(updated) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: { code: "CONFLICT", message: "Integração já usada em outro Canal." } }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  if (id === DEFAULT_INBOX_ID) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "O Canal Padrão não pode ser excluído" } },
      { status: 403 }
    );
  }

  const inbox = await prisma.inbox.findUnique({
    where: { id },
    include: { _count: { select: { conversations: true, channels: true } } },
  });
  if (!inbox) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Canal não encontrado" } },
      { status: 404 }
    );
  }

  // Não excluir Canais com histórico: ficariam conversas/handles órfãos.
  if (inbox._count.conversations > 0 || inbox._count.channels > 0) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "Canal com conversas/contatos vinculados não pode ser excluído. Desative-o.",
        },
      },
      { status: 409 }
    );
  }

  await prisma.inbox.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
