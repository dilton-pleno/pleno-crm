import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildInboxMetaConfig, inboxHasMetaToken } from "@/lib/inbox-config";
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
      whatsapp_instance: i.whatsappInstance,
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
  whatsapp_instance: z.string().max(120).optional(),
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

  const inbox = await prisma.inbox.create({
    data: {
      name: d.name.trim(),
      active: d.active ?? true,
      whatsappInstance: d.whatsapp_instance?.trim() || null,
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
        whatsapp_instance: inbox.whatsappInstance,
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
