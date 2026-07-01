import type { Automation, AutomationAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOutboundMessage, sendWhatsappTemplate } from "@/lib/outbound";
import { userSeesInbox } from "@/lib/visibility";
import { assertSafeWebhookUrl } from "@/lib/url-guard";
import { emitEvent } from "@/lib/websocket";

export type AutomationTrigger =
  | "new_message"
  | "keyword"
  | "new_contact"
  | "conversation_opened"
  | "abandoned_cart"
  | "order_status"
  | "purchase_count"
  | "schedule";

export interface TriggerContext {
  trigger: AutomationTrigger;
  conversationId?: string | null;
  contactId?: string | null;
  inboxId?: string | null;
  channelType?: string | null;
  messageContent?: string | null;
  /** Status atual do pedido (gatilho order_status). */
  orderStatus?: string | null;
  /** Nº de compras do contato (gatilho purchase_count). */
  purchaseCount?: number | null;
}

interface TriggerConfig {
  inboxId?: string | null;
  channel?: string; // "whatsapp" | "instagram" | "messenger" | "all"
  keyword?: string;
  /** Filtro de status do pedido (order_status): lista separada por vírgula; vazio = todos. */
  status?: string;
  /** Nº de compras que dispara (purchase_count): dispara quando atinge exatamente esse total. */
  count?: number;
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
  if (a.triggerType === "order_status") {
    const wanted = (cfg.status ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    if (wanted.length) {
      const current = (ctx.orderStatus ?? "").toLowerCase();
      if (!wanted.some((w) => current.includes(w))) return false;
    }
  }
  if (a.triggerType === "purchase_count") {
    const target = Number(cfg.count) || 0;
    if (target <= 0) return false; // sem meta definida, não dispara
    if ((ctx.purchaseCount ?? 0) !== target) return false;
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

// Substitui tokens {{status}}, {{nome}}, {{pedido}}, {{rastreio}} nas variáveis
// do template pelos dados do contexto/pedido. Só busca no banco se houver token.
async function resolveTemplateVars(vars: string[], ctx: TriggerContext): Promise<string[]> {
  if (!vars.some((v) => v.includes("{{"))) return vars;

  let name = "";
  let order = "";
  let tracking = "";
  if (ctx.contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: ctx.contactId },
      select: {
        name: true,
        orders: { orderBy: { createdAt: "desc" }, take: 1, select: { externalId: true, tracking: true } },
      },
    });
    name = contact?.name ?? "";
    const o = contact?.orders[0];
    order = o?.externalId ?? "";
    tracking = o?.tracking ?? "";
  }
  const map: Record<string, string> = {
    status: ctx.orderStatus ?? "",
    nome: name,
    name,
    pedido: order,
    order,
    rastreio: tracking,
    tracking,
  };
  return vars.map((v) =>
    v.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => map[k.toLowerCase()] ?? "")
  );
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
    case "send_template": {
      // Disparo ativo via template (WhatsApp API oficial), inclusive fora da
      // janela de 24h. Requer Canal com provider "cloud".
      const name = typeof cfg.template_name === "string" ? cfg.template_name.trim() : "";
      if (!name || !ctx.conversationId) return;
      const conv = await prisma.conversation.findUnique({
        where: { id: ctx.conversationId },
        select: { id: true, inboxId: true, channel: { select: { channelType: true, channelIdentifier: true } } },
      });
      if (!conv) return;
      const language = typeof cfg.language === "string" && cfg.language.trim() ? cfg.language.trim() : "pt_BR";
      const rawVars = Array.isArray(cfg.variables)
        ? cfg.variables.filter((v): v is string => typeof v === "string")
        : [];
      const variables = await resolveTemplateVars(rawVars, ctx);
      await sendWhatsappTemplate(conv, { templateName: name, language, variables, senderId: null });
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
    case "move_kanban": {
      const stageId = typeof cfg.stage_id === "string" ? cfg.stage_id : "";
      if (!stageId || !ctx.conversationId) return;
      const card = await prisma.pipelineCard.findFirst({
        where: { conversationId: ctx.conversationId },
        select: { id: true },
      });
      if (!card) return;
      await prisma.pipelineCard.update({ where: { id: card.id }, data: { stageId } });
      return;
    }
    case "webhook": {
      const url = typeof cfg.url === "string" ? cfg.url.trim() : "";
      if (!url) return;
      await assertSafeWebhookUrl(url); // anti-SSRF (bloqueia destinos internos)
      const method = (typeof cfg.method === "string" ? cfg.method : "POST").toUpperCase();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "GET" ? undefined : JSON.stringify({
            trigger: ctx.trigger,
            conversationId: ctx.conversationId,
            contactId: ctx.contactId,
            inboxId: ctx.inboxId,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      return;
    }
    // wait é tratado em runActions (não chega aqui).
    default:
      return;
  }
}

interface StoredContext {
  trigger: AutomationTrigger;
  conversationId?: string | null;
  contactId?: string | null;
  inboxId?: string | null;
  channelType?: string | null;
  messageContent?: string | null;
  orderStatus?: string | null;
  purchaseCount?: number | null;
}

// Executa as ações a partir de `startIndex`. Em `wait`, persiste o run como
// "waiting" com `resumeAt` e para — retomado depois pelo cron.
async function runActions(
  actions: AutomationAction[],
  ctx: TriggerContext,
  runId: string,
  startIndex: number
): Promise<void> {
  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i]!;
    if (action.actionType === "wait") {
      const cfg = (action.actionConfig ?? {}) as Record<string, unknown>;
      const minutes = Math.max(0, Number(cfg.minutes) || 0);
      const resumeAt = new Date(Date.now() + minutes * 60_000);
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "waiting", currentPosition: i + 1, resumeAt },
      });
      return;
    }
    try {
      await executeAction(action, ctx);
    } catch (err) {
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "error", error: err instanceof Error ? err.message : String(err) },
      });
      return;
    }
    await prisma.automationRun.update({ where: { id: runId }, data: { currentPosition: i + 1 } });
  }
  await prisma.automationRun.update({ where: { id: runId }, data: { status: "done", resumeAt: null } });
}

async function executeAutomation(a: AutomationWithActions, ctx: TriggerContext): Promise<void> {
  const storedContext: StoredContext = {
    trigger: ctx.trigger,
    conversationId: ctx.conversationId ?? null,
    contactId: ctx.contactId ?? null,
    inboxId: ctx.inboxId ?? null,
    channelType: ctx.channelType ?? null,
    messageContent: ctx.messageContent ?? null,
    orderStatus: ctx.orderStatus ?? null,
    purchaseCount: ctx.purchaseCount ?? null,
  };
  const run = await prisma.automationRun.create({
    data: {
      automationId: a.id,
      conversationId: ctx.conversationId ?? null,
      contactId: ctx.contactId ?? null,
      trigger: ctx.trigger,
      status: "running",
      context: storedContext as unknown as object,
    },
  });
  await runActions(a.actions, ctx, run.id, 0);
}

/**
 * Retoma runs em espera (`wait`) cujo `resumeAt` já passou. Chamado pelo cron
 * (N8N) em `/api/internal/automations/resume`. Recarrega as ações da automação.
 */
export async function resumeDueRuns(limit = 50): Promise<{ resumed: number }> {
  const due = await prisma.automationRun.findMany({
    where: { status: "waiting", resumeAt: { lte: new Date() } },
    orderBy: { resumeAt: "asc" },
    take: limit,
    include: { automation: { include: { actions: { orderBy: { position: "asc" } } } } },
  });

  let resumed = 0;
  for (const run of due) {
    try {
      const stored = (run.context ?? {}) as unknown as StoredContext;
      const ctx: TriggerContext = {
        trigger: (stored.trigger ?? "schedule") as AutomationTrigger,
        conversationId: stored.conversationId ?? null,
        contactId: stored.contactId ?? null,
        inboxId: stored.inboxId ?? null,
        channelType: stored.channelType ?? null,
        messageContent: stored.messageContent ?? null,
        orderStatus: stored.orderStatus ?? null,
        purchaseCount: stored.purchaseCount ?? null,
      };
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "running" } });
      await runActions(run.automation.actions, ctx, run.id, run.currentPosition);
      resumed++;
    } catch (err) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: { status: "error", error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
  return { resumed };
}

/**
 * Executa automações com gatilho `schedule`. Chamado pelo cron (N8N) em
 * `/api/internal/automations/run-scheduled`. Dispara uma vez por dia, a partir
 * do horário configurado (triggerConfig.time "HH:mm", days opcional), com dedup
 * por dia via AutomationRun. Sem conversa/contato (ações de alvo são no-op).
 */
export async function runScheduledAutomations(): Promise<{ triggered: number }> {
  const automations = await prisma.automation.findMany({
    where: { active: true, triggerType: "schedule" },
    include: { actions: { orderBy: { position: "asc" } } },
  });

  const { minutes: nowMin, day } = nowSaoPaulo();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  let triggered = 0;
  for (const a of automations) {
    try {
      const cfg = (a.triggerConfig ?? {}) as TriggerConfig & { time?: string };
      const time = typeof cfg.time === "string" ? cfg.time : null;
      if (!time) continue;
      if (nowMin < parseHHMM(time)) continue;
      if (cfg.hours?.days && cfg.hours.days.length && !cfg.hours.days.includes(day)) continue;

      const alreadyToday = await prisma.automationRun.findFirst({
        where: { automationId: a.id, createdAt: { gte: startOfToday }, status: { in: ["done", "running", "waiting"] } },
        select: { id: true },
      });
      if (alreadyToday) continue;

      await executeAutomation(a, {
        trigger: "schedule",
        conversationId: null,
        contactId: null,
        inboxId: (cfg.inboxId as string) ?? null,
      });
      triggered++;
    } catch (err) {
      console.error(`[automation] erro no schedule ${a.id}:`, err);
    }
  }
  return { triggered };
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
