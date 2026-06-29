import { NextRequest, NextResponse } from "next/server";
import type { Prisma, ChannelType } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { visibleInboxIds } from "@/lib/visibility";

const CHANNEL_VALUES: ChannelType[] = ["whatsapp", "instagram", "messenger", "email", "site"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("kanban");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const { searchParams } = request.nextUrl;

  const agentId = searchParams.get("agent_id");
  const channelParam = searchParams.get("channel");
  const tagId = searchParams.get("tag");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Filtros aplicados nos cards (agente/canal vêm da conversa).
  const conversationFilter: Prisma.ConversationWhereInput = {};
  if (agentId) conversationFilter.assignedTo = agentId;
  if (channelParam && (CHANNEL_VALUES as string[]).includes(channelParam)) {
    conversationFilter.channel = { channelType: channelParam as ChannelType };
  }
  // Visibilidade por time: restringe os cards aos Canais visíveis.
  const visible = await visibleInboxIds(guard.session.user);
  if (visible) conversationFilter.inboxId = { in: visible };

  const cardWhere: Prisma.PipelineCardWhereInput = {};
  if (Object.keys(conversationFilter).length > 0) {
    cardWhere.conversation = conversationFilter;
  }
  if (tagId) {
    cardWhere.contact = { tags: { some: { id: tagId } } };
  }
  if (from || to) {
    cardWhere.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const pipeline = await prisma.pipeline.findUnique({
    where: { id },
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: cardWhere,
            orderBy: { updatedAt: "desc" },
            include: {
              conversation: {
                include: {
                  channel: { select: { channelType: true } },
                  agent: { select: { id: true, name: true } },
                  messages: {
                    orderBy: { sentAt: "desc" },
                    take: 1,
                    select: { content: true, sentAt: true, direction: true },
                  },
                },
              },
              contact: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  phone: true,
                  tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
                  orders: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { status: true, total: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!pipeline) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Pipeline não encontrado" } },
      { status: 404 }
    );
  }

  const now = Date.now();

  // Não lidas por conversa (mensagens recebidas ainda não lidas).
  const conversationIds = pipeline.stages.flatMap((s) => s.cards.map((c) => c.conversationId));
  const unreadGroups =
    conversationIds.length > 0
      ? await prisma.message.groupBy({
          by: ["conversationId"],
          where: { conversationId: { in: conversationIds }, direction: "in", readAt: null },
          _count: { id: true },
        })
      : [];
  const unreadMap = Object.fromEntries(unreadGroups.map((u) => [u.conversationId, u._count.id]));

  const stages = pipeline.stages.map((stage) => {
    const cards = stage.cards.map((card) => {
      const lastMsg = card.conversation.messages[0];
      const lastActivity = lastMsg?.sentAt ?? card.updatedAt;
      const lastOrder = card.contact.orders[0];
      return {
        id: card.id,
        conversation_id: card.conversationId,
        contact: {
          id: card.contact.id,
          name: card.contact.name,
          avatar_url: card.contact.avatarUrl,
          phone: card.contact.phone,
          tags: card.contact.tags,
        },
        channel_type: card.conversation.channel.channelType,
        last_message_preview: lastMsg?.content ?? null,
        last_direction: lastMsg?.direction ?? null,
        last_activity_at: lastActivity.toISOString(),
        unread_count: unreadMap[card.conversationId] ?? 0,
        time_in_stage_seconds: Math.round((now - card.updatedAt.getTime()) / 1000),
        last_order: lastOrder
          ? { status: lastOrder.status, total: Number(lastOrder.total) }
          : null,
        assigned_to: card.conversation.agent
          ? {
              id: card.conversation.agent.id,
              name: card.conversation.agent.name,
              avatar_url: null,
            }
          : null,
      };
    });

    // Tempo médio de permanência: média de (agora - última movimentação).
    const avgMs =
      stage.cards.length > 0
        ? stage.cards.reduce((acc, c) => acc + (now - c.updatedAt.getTime()), 0) /
          stage.cards.length
        : 0;

    return {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      position: stage.position,
      card_count: cards.length,
      avg_time_seconds: Math.round(avgMs / 1000),
      cards,
    };
  });

  return NextResponse.json({
    data: {
      pipeline: { id: pipeline.id, name: pipeline.name },
      stages,
    },
  });
}
