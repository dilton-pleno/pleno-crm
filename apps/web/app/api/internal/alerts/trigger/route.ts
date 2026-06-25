import { NextRequest, NextResponse } from "next/server";
import type { Alert } from "@prisma/client";
import { requireInternalSecret } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";
import { summarize, type CampaignRow } from "@/lib/analytics-query";

const SELECT = {
  spend: true,
  reach: true,
  clicks: true,
  impressions: true,
  cpm: true,
  ctr: true,
  roas: true,
  conversions: true,
} as const;

const METRIC_LABEL: Record<string, string> = {
  spend: "Investimento",
  reach: "Alcance",
  clicks: "Cliques",
  cpm: "CPM",
  ctr: "CTR",
  roas: "ROAS",
  conversions: "Conversões",
};

const OPERATOR_LABEL: Record<string, string> = { gt: "acima de", lt: "abaixo de", eq: "igual a" };

function metricValue(summary: ReturnType<typeof summarize>, metric: string): number | null {
  switch (metric) {
    case "spend": return summary.total_spend;
    case "reach": return summary.total_reach;
    case "clicks": return summary.total_clicks;
    case "conversions": return summary.total_conversions;
    case "cpm": return summary.avg_cpm;
    case "ctr": return summary.avg_ctr;
    case "roas": return summary.avg_roas;
    default: return null;
  }
}

function breaches(value: number, operator: string, threshold: number): boolean {
  if (operator === "gt") return value > threshold;
  if (operator === "lt") return value < threshold;
  if (operator === "eq") return Math.abs(value - threshold) < 0.0001;
  return false;
}

/**
 * Avalia os alertas ativos contra as métricas do dia mais recente disponível e
 * cria notificações para os que ultrapassam o threshold. Chamado pelo job
 * diário do N8N. Não depende do usuário (secret interno).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const latest = await prisma.campaignMetric.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) {
    return NextResponse.json({ data: { evaluated: 0, triggered: 0 } });
  }

  const day = latest.date;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const alerts = await prisma.alert.findMany({ where: { active: true } });
  let triggered = 0;

  for (const alert of alerts) {
    const rows = await prisma.campaignMetric.findMany({
      where: {
        date: day,
        ...(alert.platform === "both" ? {} : { platform: alert.platform as "meta" | "google" }),
      },
      select: SELECT,
    });

    const summary = summarize(rows as CampaignRow[]);
    const value = metricValue(summary, alert.metric);
    if (value === null) continue;

    if (!breaches(value, alert.operator, Number(alert.threshold))) continue;

    // Dedup: evita repetir notificação do mesmo alerta no mesmo dia.
    const alreadyToday = await prisma.alertNotification.findFirst({
      where: { alertId: alert.id, createdAt: { gte: startOfToday } },
    });
    if (alreadyToday) continue;

    const message = buildMessage(alert, value);
    const notification = await prisma.alertNotification.create({
      data: { alertId: alert.id, message },
    });
    await prisma.alert.update({ where: { id: alert.id }, data: { notifiedAt: new Date() } });

    emitEvent("alert:triggered", {
      notificationId: notification.id,
      alertId: alert.id,
      message,
    });
    triggered++;
  }

  return NextResponse.json({ data: { evaluated: alerts.length, triggered } });
}

function buildMessage(alert: Alert, value: number): string {
  const metric = METRIC_LABEL[alert.metric] ?? alert.metric;
  const op = OPERATOR_LABEL[alert.operator] ?? alert.operator;
  const threshold = Number(alert.threshold);
  const valueStr = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return `${alert.name}: ${metric} ${op} ${threshold} (atual: ${valueStr})`;
}
