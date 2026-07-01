import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildInboxMetaConfig, inboxHasMetaToken } from "@/lib/inbox-config";
import { buildWhatsappCloudConfig, inboxHasCloudToken, inboxCloudWabaId } from "@/lib/whatsapp-channel-config";
import { DEFAULT_INBOX_ID } from "@/lib/inbox-routing";

// Lista os Canais (Inboxes) com contagem de conversas e flags de configuração.
export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const inboxes = await prisma.inbox.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { conversations: true, channels: true } } },
  });

  return NextResponse.json({
    data: inboxes.map((i) => ({
      id: i.id,
      name: i.name,
      active: i.active,
      whatsapp_provider: i.whatsappProvider === "cloud" ? "cloud" : "evolution",
      whatsapp_instance: i.whatsappInstance,
      whatsapp_phone_number_id: i.whatsappPhoneNumberId,
      whatsapp_waba_id: inboxCloudWabaId(i.whatsappConfig),
      has_cloud_token: inboxHasCloudToken(i.whatsappConfig),
      meta_page_id: i.metaPageId,
      meta_ig_id: i.metaIgId,
      has_meta_token: inboxHasMetaToken(i.metaConfig),
      is_default: i.id === DEFAULT_INBOX_ID,
      conversation_count: i._count.conversations,
      channel_count: i._count.channels,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  active: z.boolean().optional(),
  whatsapp_provider: z.enum(["evolution", "cloud"]).optional(),
  whatsapp_instance: z.string().max(120).optional(),
  whatsapp_phone_number_id: z.string().max(120).optional(),
  whatsapp_waba_id: z.string().max(120).optional(),
  whatsapp_cloud_token: z.string().optional(),
  whatsapp_verify_token: z.string().max(200).optional(),
  meta_page_id: z.string().max(120).optional(),
  meta_ig_id: z.string().max(120).optional(),
  meta_access_token: z.string().optional(),
});

// Cria um Canal.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }
  const d = parsed.data;

  const hasCloudInput = Boolean(
    d.whatsapp_cloud_token || d.whatsapp_waba_id || d.whatsapp_verify_token
  );

  const inbox = await prisma.inbox.create({
    data: {
      name: d.name.trim(),
      active: d.active ?? true,
      whatsappProvider: d.whatsapp_provider ?? "evolution",
      whatsappInstance: d.whatsapp_instance?.trim() || null,
      whatsappPhoneNumberId: d.whatsapp_phone_number_id?.trim() || null,
      whatsappConfig: hasCloudInput
        ? buildWhatsappCloudConfig(null, {
            accessToken: d.whatsapp_cloud_token,
            wabaId: d.whatsapp_waba_id,
            verifyToken: d.whatsapp_verify_token,
          })
        : undefined,
      metaPageId: d.meta_page_id?.trim() || null,
      metaIgId: d.meta_ig_id?.trim() || null,
      metaConfig: d.meta_access_token ? buildInboxMetaConfig(null, d.meta_access_token) : undefined,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: inbox.id,
        name: inbox.name,
        active: inbox.active,
        whatsapp_provider: inbox.whatsappProvider === "cloud" ? "cloud" : "evolution",
        whatsapp_instance: inbox.whatsappInstance,
        whatsapp_phone_number_id: inbox.whatsappPhoneNumberId,
        whatsapp_waba_id: inboxCloudWabaId(inbox.whatsappConfig),
        has_cloud_token: inboxHasCloudToken(inbox.whatsappConfig),
        meta_page_id: inbox.metaPageId,
        meta_ig_id: inbox.metaIgId,
        has_meta_token: inboxHasMetaToken(inbox.metaConfig),
        is_default: false,
        conversation_count: 0,
        channel_count: 0,
      },
    },
    { status: 201 }
  );
}
