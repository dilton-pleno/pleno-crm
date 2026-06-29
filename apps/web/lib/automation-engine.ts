import type { Automation, AutomationAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOutboundMessage } from "@/lib/outbound";
import { userSeesInbox } from "@/lib/visibility";
import { emitEvent } from "@/lib/websocket";

export type AutomationTrigger =
  | "new_message"
  | "keyword"
  | "new_contact"
  | "conversation_opened"
  | "schedule";

export interface TriggerContext {
  trigger: AutomationTrigger;
  conversationId?: string | null;
  contactId?: string | null;
  inboxId?: string | null;
  channelType?: string | null;
  messageContent?: string | null;
}

interface TriggerConfig {
  inboxId?: string | null;
  channel?: string; // "whatsapp" | "instagram" | "messenger" | "all"
  keyword?: string;
  oncePerContact?: boolean;
  hours?: { start: string; end: string; outside?: boolean; days?: number[] };
}

type AutomationWithActions = Automation & { actions: AutomationAction[] };

// ---- Horário (America/Sao_Paulo) ----
function parseHHMM(v: string): number {
  const [h, m] = v.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function nowSaoPaulo(): { minutes: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { minutes: hour * 60 + minute, day: map[wd] ?? 1 };
}

function withinHours(cfg: TriggerConfig): boolean {
  if (!cfg.hours) return true;
  const { minutes, day } = nowSaoPaulo();
  const start = parseHHMM(cfg.hours.start);
  const end = parseHHMM(cfg.hours.end);
  let inWindow = minutes >= start && minutes < end;
  if (cfg.hours.days && cfg.hours.days.length) inWindow = inWindow && cfg.hours.days.includes(day);
  return cfg.hours.outside ? !inWindow : inWindow;
}

function matchesTrigger(a: AutomationWithActions, ctx: TriggerContext): boolean {
  const cfg = (a.triggerConfig ?? {}) as TriggerConfig;
  if (cfg.inboxId && cfg.inboxId !== ctx.inboxId) return false;
  if (cfg.channel && cfg.channel !== "all" && ctx.channelType && cfg.channel !== ctx.channelType) {
    return false;
  }
  if (a.triggerType === "keyword") {
    const kw = (cfg.keyword ?? "").trim().toLowerCase();
    if (!kw) return false;
    if (!(ctx.messageContent ?? "").toLowerCase().includes(kw)) return false;
  }
  return true;
}

async function isDuplicate(a: AutomationWithActions, ctx: TriggerContext): Promise<boolean> {
  const cfg = (a.triggerConfig ?? {}) as TriggerConfig;
  if (!cfg.oncePerContact || !ctx.contactId) return false;
  const prev = await prisma.automationRun.findFirst({
    where: { automationId: a.id, contactId: ctx.contactId, status: { in: ["done", "running", "waiting"] } },
    select: { id: true },
  });
  return Boolean(prev);
}

async function executeAction(action: AutomationAction, ctx: TriggerContext): Promise<void> {
  const cfg = (action.actionConfig ?? {}) as Record<string, unknown>;

  switch (action.actionType) {
    case "send_message": {
      const message = typeof cfg.message === "string" ? cfg.message : null;
      if (!message || !ctx.conversationId) return;
      const conv = await prisma.conversation.findUnique({
        where: { id: ctx.conversationId },
        select: { id: true, inboxId: true, channel: { select: { channelType: true, channelIdentifier: true } } },
      });
      if (!conv) return;
      await sendOutboundMessage(conv, { content: message, senderId: null });
      return;
    }
    case "add_tag": {
      const tagName = typeof cfg.tag === "string" ? cfg.tag.trim() : "";
      if (!tagName || !ctx.contactId) return;
      const tag = await prisma.tag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } });
      await prisma.contact.update({
        where: { id: ctx.contactId },
        data: { tags: { connect: { id: tag.id } } },
      });
      return;
    }
    case "assign_agent": {
      const userId = typeof cfg.user_id === "string" ? cfg.user_id : null;
      if (!userId || !ctx.conversationId) return;
      // Respeita times: só atribui a quem enxerga o Canal da conversa.
      if (ctx.inboxId && !(await userSeesInbox(userId, ctx.inboxId))) return;
      const updated = await prisma.conversation.update({
        where: { id: ctx.conversationId },
        data: { assignedTo: userId },
        include: { agent: { select: { id: true, name: true } } },
      });
      emitEvent("conversation:assigned", {
        conversationId: ctx.conversationId,
        assignedTo: { id: updated.agent?.id, name: updated.agent?.name },
      });
      return;
    }
    // move_kanban, webhook, wait, schedule → Fase 3 (ignorados silenciosamente).
    default:
      return;
  }
}

async function executeAutomation(a: AutomationWithActions, ctx: TriggerContext): Promise<void> {
  const run = await prisma.automationRun.create({
    data: {
      automationId: a.id,
      conversationId: ctx.conversationId ?? null,
      contactId: ctx.contactId ?? null,
      trigger: ctx.trigger,
      status: "running",
    },
  });

  try {
    for (const action of a.actions) {
      await executeAction(action, ctx);
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { currentPosition: action.position },
      });
    }
    await prisma.automationRun.update({ where: { id: run.id }, data: { status: "done" } });
  } catch (err) {
    await prisma.automationRun.update({
      where: { id: run.id },
      data: { status: "error", error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Avalia e executa as automações ativas para um gatilho. Tolerante a falhas:
 * nunca lança (não pode quebrar a ingestão de mensagens). A execução é
 * in-process — reaproveita envio por Canal, etiquetas e atribuição já existentes.
 */
export async function runAutomationsFor(ctx: TriggerContext): Promise<void> {
  try {
    const automations = await prisma.automation.findMany({
      where: { active: true, triggerType: ctx.trigger },
      include: { actions: { orderBy: { position: "asc" } } },
    });
    for (const a of automations) {
      try {
        if (!matchesTrigger(a, ctx)) continue;
        if (!withinHours((a.triggerConfig ?? {}) as TriggerConfig)) continue;
        if (await isDuplicate(a, ctx)) continue;
        await executeAutomation(a, ctx);
      } catch (err) {
        console.error(`[automation] erro na automação ${a.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[automation] erro ao carregar automações:", err);
  }
}
