import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Não autenticado" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({ where: { id } });
  if (!conversation) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conversa não encontrada" } },
      { status: 404 }
    );
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { sentAt: "asc" },
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  // Mark incoming messages as read
  await prisma.message.updateMany({
    where: { conversationId: id, direction: "in", readAt: null },
    data: { readAt: new Date() },
  });

  const data = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    content: m.content,
    media_url: m.mediaUrl,
    media_type: m.mediaType,
    sent_at: m.sentAt.toISOString(),
    delivered_at: m.deliveredAt?.toISOString() ?? null,
    read_at: m.readAt?.toISOString() ?? null,
    sender: m.sender
      ? { id: m.sender.id, name: m.sender.name, type: "agent" as const }
      : { id: conversation.contactId, name: "Contato", type: "contact" as const },
  }));

  return NextResponse.json({ data });
}
