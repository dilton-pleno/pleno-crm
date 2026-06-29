import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildInboxMetaConfig, inboxHasMetaToken } from "@/lib/inbox-config";
import { DEFAULT_INBOX_ID } from "@/lib/inbox-routing";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  active: z.boolean().optional(),
  whatsapp_instance: z.string().max(120).optional().nullable(),
  meta_page_id: z.string().max(120).optional().nullable(),
  meta_ig_id: z.string().max(120).optional().nullable(),
  meta_access_token: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const inbox = await prisma.inbox.findUnique({ where: { id } });
  if (!inbox) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Canal não encontrado" } },
      { status: 404 }
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }
  const d = parsed.data;

  // Campos texto: string vazia/null limpa; ausente mantém. Token: só grava se vier.
  const norm = (v: string | null | undefined): string | null | undefined =>
    v === undefined ? undefined : (v?.trim() || null);

  const updated = await prisma.inbox.update({
    where: { id },
    data: {
      name: d.name?.trim(),
      active: d.active,
      whatsappInstance: norm(d.whatsapp_instance),
      metaPageId: norm(d.meta_page_id),
      metaIgId: norm(d.meta_ig_id),
      metaConfig: d.meta_access_token
        ? buildInboxMetaConfig(inbox.metaConfig, d.meta_access_token)
        : undefined,
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      active: updated.active,
      whatsapp_instance: updated.whatsappInstance,
      meta_page_id: updated.metaPageId,
      meta_ig_id: updated.metaIgId,
      has_meta_token: inboxHasMetaToken(updated.metaConfig),
      is_default: updated.id === DEFAULT_INBOX_ID,
    },
  });
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
