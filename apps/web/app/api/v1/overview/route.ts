import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getAccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { summarize, dec, type CampaignRow } from "@/lib/analytics-query";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("visao_geral");
  if (!guard.ok) return guard.response;
  const role = guard.session.user.role;

  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 86400000);
  const last30 = new Date(now.getTime() - 30 * 86400000);

  // ---- Atendimento ----
  const [statusGroups, unread, newConversations] = await Promise.all([
    prisma.conversation.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.message.count({ where: { direction: "in", readAt: null } }),
    prisma.conversation.count({ where: { createdAt: { gte: last7 } } }),
  ]);
  const statusMap: Record<string, number> = {};
  for (const g of statusGroups) statusMap[g.status] = g._count.id;

  const atendimento = {
    open: statusMap.open ?? 0,
    pending: statusMap.pending ?? 0,
    resolved: statusMap.resolved ?? 0,
    unread,
    new_last_7_days: newConversations,
  };

  // ---- Campanhas (somente quem tem acesso a campanhas) ----
  let campanhas: {
    spend: number;
    clicks: number;
    reach: number;
    roas: number;
  } | null = null;

  if (getAccessLevel(role, "campanhas") !== "none") {
    const rows = await prisma.campaignMetric.findMany({
      where: { date: { gte: last30 } },
      select: {
        spend: true,
        reach: true,
        clicks: true,
        impressions: true,
        cpm: true,
        ctr: true,
        roas: true,
        conversions: true,
      },
    });
    const s = summarize(rows as CampaignRow[]);
    campanhas = {
      spend: s.total_spend,
      clicks: s.total_clicks,
      reach: s.total_reach,
      roas: s.avg_roas,
    };
  }

  // ---- Ecommerce (Wbuy — Módulo 5, ainda não integrado) ----
  // Apenas Admin/Gestor; o Atendente vê só o atendimento.
  let ecommerce: { integrated: boolean; orders: number; revenue: number } | null = null;
  if (getAccessLevel(role, "ecommerce") !== "none") {
    const ordersAgg = await prisma.order.aggregate({
      _count: { id: true },
      _sum: { total: true },
    });
    ecommerce = {
      integrated: ordersAgg._count.id > 0,
      orders: ordersAgg._count.id,
      revenue: ordersAgg._sum.total ? dec(ordersAgg._sum.total) : 0,
    };
  }

  return NextResponse.json({
    data: { atendimento, campanhas, ecommerce },
  });
}
