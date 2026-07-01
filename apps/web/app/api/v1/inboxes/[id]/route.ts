import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildInboxMetaConfig, inboxHasMetaToken } from "@/lib/inbox-config";
import { buildWhatsappCloudConfig, inboxHasCloudToken, inboxCloudWabaId } from "@/lib/whatsapp-channel-config";
import { DEFAULT_INBOX_ID } from "@/lib/inbox-routing";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  active: z.boolean().optional(),
  whatsapp_provider: z.enum(["evolution", "cloud"]).optional(),
  whatsapp_instance: z.string().max(120).optional().nullable(),
  whatsapp_phone_number_id: z.string().max(120).optional().nullable(),
  whatsapp_waba_id: z.string().max(120).optional(),
  whatsapp_cloud_token: z.string().optional(),
  whatsapp_verify_token: z.string().max(200).optional(),
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

  // whatsappConfig só é reescrito quando algum campo do Cloud vem no payload
  // (token/waba/verify); caso contrário, mantém o valor atual.
  const cloudTouched =
    d.whatsapp_cloud_token !== undefined ||
    d.whatsapp_waba_id !== undefined ||
    d.whatsapp_verify_token !== undefined;

  const updated = await prisma.inbox.update({
    where: { id },
    data: {
      name: d.name?.trim(),
      active: d.active,
      whatsappProvider: d.whatsapp_provider,
      whatsappInstance: norm(d.whatsapp_instance),
      whatsappPhoneNumberId: norm(d.whatsapp_phone_number_id),
      whatsappConfig: cloudTouched
        ? buildWhatsappCloudConfig(inbox.whatsappConfig, {
            accessToken: d.whatsapp_cloud_token,
            wabaId: d.whatsapp_waba_id,
            verifyToken: d.whatsapp_verify_token,
          })
        : undefined,
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
      whatsapp_provider: updated.whatsappProvider === "cloud" ? "cloud" : "evolution",
      whatsapp_instance: updated.whatsappInstance,
      whatsapp_phone_number_id: updated.whatsappPhoneNumberId,
      whatsapp_waba_id: inboxCloudWabaId(updated.whatsappConfig),
      has_cloud_token: inboxHasCloudToken(updated.whatsappConfig),
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
