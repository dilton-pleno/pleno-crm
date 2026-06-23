import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { ConversationStatus } from "@prisma/client";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("atendimento");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as ConversationStatus | null;
  const assignedTo = searchParams.get("assigned_to");
  const search = searchParams.get("search");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(status ? { status } : {}),
    ...(assignedTo === "me"
      ? { assignedTo: session.user.id }
      : assignedTo === "unassigned"
      ? { assignedTo: null }
      : assignedTo
      ? { assignedTo }
      : {}),
    ...(search
      ? {
          contact: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
            ],
          },
        }
      : {}),
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        contact: { select: { id: true, name: true, avatarUrl: true } },
        channel: { select: { channelType: true } },
        agent: { select: { id: true, name: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { content: true, direction: true, sentAt: true },
        },
      },
    }),
    prisma.conversation.count({ where }),
  ]);

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      direction: "in",
      readAt: null,
    },
    _count: { id: true },
  });

  const unreadMap = Object.fromEntries(
    unreadCounts.map((u) => [u.conversationId, u._count.id])
  );

  const data = conversations.map((c) => ({
    id: c.id,
    contact: {
      id: c.contact.id,
      name: c.contact.name,
      avatar_url: c.contact.avatarUrl,
    },
    last_message: c.messages[0]
      ? {
          content: c.messages[0].content,
          direction: c.messages[0].direction,
          sent_at: c.messages[0].sentAt.toISOString(),
        }
      : null,
    unread_count: unreadMap[c.id] ?? 0,
    status: c.status,
    channel_type: c.channel.channelType,
    assigned_to: c.agent ? { id: c.agent.id, name: c.agent.name } : null,
  }));

  return NextResponse.json({
    data,
    meta: { total, page, limit },
  });
}
