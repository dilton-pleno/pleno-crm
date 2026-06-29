import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { requireConversationAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  // Object-level authz: só conversas de Canais visíveis ao usuário.
  const access = await requireConversationAccess(guard.session, id);
  if (!access.ok) return access.response;

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { sentAt: "asc" },
    // mediaData (bytes) é pesado e não deve ir na listagem; é servido sob
    // demanda pela rota /api/v1/messages/[id]/media. Selecionamos só a flag.
    omit: { mediaData: true },
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  // Ids das mensagens com bytes armazenados (mídia do WhatsApp via Evolution),
  // sem carregar os bytes em si. Essas são servidas pela rota de proxy; as
  // demais (ex.: Instagram) seguem usando a URL externa em mediaUrl.
  const withStoredMedia = await prisma.message.findMany({
    where: { conversationId: id, mediaData: { not: null } },
    select: { id: true },
  });
  const storedMediaIds = new Set(withStoredMedia.map((m) => m.id));

  // Mark incoming messages as read
  await prisma.message.updateMany({
    where: { conversationId: id, direction: "in", readAt: null },
    data: { readAt: new Date() },
  });

  const data = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    content: m.content,
    media_url: storedMediaIds.has(m.id)
      ? `/api/v1/messages/${m.id}/media`
      : m.mediaUrl,
    media_type: m.mediaType,
    media_file_name: m.mediaFileName,
    sent_at: m.sentAt.toISOString(),
    delivered_at: m.deliveredAt?.toISOString() ?? null,
    read_at: m.readAt?.toISOString() ?? null,
    sender: m.sender
      ? { id: m.sender.id, name: m.sender.name, type: "agent" as const }
      : { id: access.value.contactId, name: "Contato", type: "contact" as const },
  }));

  return NextResponse.json({ data });
}
