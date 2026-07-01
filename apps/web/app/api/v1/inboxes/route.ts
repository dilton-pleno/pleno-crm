import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_INBOX_ID } from "@/lib/inbox-routing";

const withIntegrations = {
  _count: { select: { conversations: true, channels: true } },
  whatsappIntegration: { select: { id: true, name: true, provider: true } },
  metaIntegration: { select: { id: true, name: true } },
} as const;

type InboxRow = Prisma.InboxGetPayload<{ include: typeof withIntegrations }>;

function serialize(i: InboxRow) {
  return {
    id: i.id,
    name: i.name,
    active: i.active,
    is_default: i.id === DEFAULT_INBOX_ID,
    whatsapp_integration: i.whatsappIntegration
      ? { id: i.whatsappIntegration.id, name: i.whatsappIntegration.name, provider: i.whatsappIntegration.provider }
      : null,
    meta_integration: i.metaIntegration ? { id: i.metaIntegration.id, name: i.metaIntegration.name } : null,
    conversation_count: i._count.conversations,
    channel_count: i._count.channels,
  };
}

// Erro de exclusividade 1:1 (uma integração já usada em outro Canal).
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// Lista os Canais (Inboxes) com as integrações vinculadas.
export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const inboxes = await prisma.inbox.findMany({ orderBy: { createdAt: "asc" }, include: withIntegrations });
  return NextResponse.json({ data: inboxes.map(serialize) });
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  active: z.boolean().optional(),
  whatsapp_integration_id: z.string().uuid().optional().nullable(),
  meta_integration_id: z.string().uuid().optional().nullable(),
});

// Cria um Canal.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, { status: 422 });
  }
  const d = parsed.data;

  try {
    const inbox = await prisma.inbox.create({
      data: {
        name: d.name.trim(),
        active: d.active ?? true,
        whatsappIntegrationId: d.whatsapp_integration_id ?? undefined,
        metaIntegrationId: d.meta_integration_id ?? undefined,
      },
      include: withIntegrations,
    });
    return NextResponse.json({ data: serialize(inbox) }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: { code: "CONFLICT", message: "Integração já usada em outro Canal." } }, { status: 409 });
    }
    throw err;
  }
}
