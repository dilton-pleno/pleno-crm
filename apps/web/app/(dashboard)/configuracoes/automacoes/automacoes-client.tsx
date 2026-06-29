"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, Zap, Power, ChevronUp, ChevronDown,
  MessageSquare, Tag as TagIcon, UserPlus, ListChecks, History,
} from "lucide-react";

const INPUT = "text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring";

export interface Option { id: string; name: string }
export interface ActionDetail { action_type: string; action_config: Record<string, unknown> }
export interface AutomationDetail {
  id: string;
  name: string;
  active: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  actions: ActionDetail[];
  run_count: number;
  last_run: { status: string; created_at: string } | null;
}

interface Props {
  initialAutomations: AutomationDetail[];
  inboxes: Option[];
  agents: Option[];
  tags: string[];
  isAdmin: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
  new_message: "Nova mensagem",
  keyword: "Palavra-chave",
  new_contact: "Novo contato",
  conversation_opened: "Conversa aberta",
};
const TRIGGERS = Object.keys(TRIGGER_LABELS);

const ACTION_LABELS: Record<string, string> = {
  send_message: "Enviar mensagem",
  add_tag: "Adicionar etiqueta",
  assign_agent: "Atribuir agente",
};
const ACTION_TYPES = Object.keys(ACTION_LABELS);

const ACTION_ICON: Record<string, React.ElementType> = {
  send_message: MessageSquare,
  add_tag: TagIcon,
  assign_agent: UserPlus,
};

const STATUS_STYLE: Record<string, string> = {
  done: "text-green-600",
  error: "text-destructive",
  running: "text-blue-600",
  waiting: "text-amber-600",
};

const CHANNELS = [
  { id: "all", name: "Todos" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "instagram", name: "Instagram" },
  { id: "messenger", name: "Messenger" },
];

interface BuilderAction { action_type: string; config: Record<string, string> }
interface BuilderState {
  name: string;
  trigger_type: string;
  channel: string;
  inboxId: string;
  keyword: string;
  oncePerContact: boolean;
  useHours: boolean;
  hoursStart: string;
  hoursEnd: string;
  hoursOutside: boolean;
  active: boolean;
  actions: BuilderAction[];
}

function blankBuilder(): BuilderState {
  return {
    name: "", trigger_type: "new_contact", channel: "all", inboxId: "", keyword: "",
    oncePerContact: false, useHours: false, hoursStart: "08:00", hoursEnd: "18:00",
    hoursOutside: false, active: false, actions: [],
  };
}

function fromAutomation(a: AutomationDetail): BuilderState {
  const c = a.trigger_config ?? {};
  const hours = c.hours as { start?: string; end?: string; outside?: boolean } | undefined;
  return {
    name: a.name,
    trigger_type: a.trigger_type,
    channel: (c.channel as string) || "all",
    inboxId: (c.inboxId as string) || "",
    keyword: (c.keyword as string) || "",
    oncePerContact: Boolean(c.oncePerContact),
    useHours: Boolean(hours),
    hoursStart: hours?.start || "08:00",
    hoursEnd: hours?.end || "18:00",
    hoursOutside: Boolean(hours?.outside),
    active: a.active,
    actions: a.actions.map((ac) => ({
      action_type: ac.action_type,
      config: {
        message: String(ac.action_config.message ?? ""),
        tag: String(ac.action_config.tag ?? ""),
        user_id: String(ac.action_config.user_id ?? ""),
      },
    })),
  };
}

function toPayload(s: BuilderState) {
  const trigger_config: Record<string, unknown> = {};
  if (s.channel !== "all") trigger_config.channel = s.channel;
  if (s.inboxId) trigger_config.inboxId = s.inboxId;
  if (s.trigger_type === "keyword" && s.keyword.trim()) trigger_config.keyword = s.keyword.trim();
  if (s.oncePerContact) trigger_config.oncePerContact = true;
  if (s.useHours) trigger_config.hours = { start: s.hoursStart, end: s.hoursEnd, outside: s.hoursOutside };

  const actions = s.actions.map((a, i) => {
    const cfg: Record<string, unknown> = {};
    if (a.action_type === "send_message") cfg.message = a.config.message ?? "";
    else if (a.action_type === "add_tag") cfg.tag = a.config.tag ?? "";
    else if (a.action_type === "assign_agent") cfg.user_id = a.config.user_id ?? "";
    return { position: i + 1, action_type: a.action_type, action_config: cfg };
  });

  return { name: s.name.trim(), trigger_type: s.trigger_type, trigger_config, active: s.active, actions };
}

export function AutomacoesClient({ initialAutomations, inboxes, agents, tags, isAdmin }: Props) {
  const [automations, setAutomations] = useState<AutomationDetail[]>(initialAutomations);
  const [tab, setTab] = useState<"automacoes" | "execucoes">("automacoes");
  const [editing, setEditing] = useState<{ id: string | null; state: BuilderState } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startNew = () => setEditing({ id: null, state: blankBuilder() });
  const startEdit = (a: AutomationDetail) => setEditing({ id: a.id, state: fromAutomation(a) });

  const save = useCallback(async (id: string | null, state: BuilderState) => {
    setError(null);
    const payload = toPayload(state);
    const res = await fetch(id ? `/api/v1/automations/${id}` : "/api/v1/automations", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? "Falha ao salvar automação");
      return;
    }
    const saved = json.data as AutomationDetail;
    setAutomations((prev) => (id ? prev.map((a) => (a.id === id ? saved : a)) : [...prev, saved]));
    setEditing(null);
  }, []);

  const toggle = useCallback(async (a: AutomationDetail) => {
    setAutomations((prev) => prev.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/v1/automations/${a.id}/toggle`, { method: "PATCH" });
  }, []);

  const remove = useCallback(async (a: AutomationDetail) => {
    if (!confirm(`Excluir a automação "${a.name}"?`)) return;
    setAutomations((prev) => prev.filter((x) => x.id !== a.id));
    await fetch(`/api/v1/automations/${a.id}`, { method: "DELETE" });
  }, []);

  if (editing) {
    return (
      <AutomationBuilder
        initial={editing.state}
        isNew={editing.id === null}
        inboxes={inboxes}
        agents={agents}
        tags={tags}
        error={error}
        onCancel={() => { setEditing(null); setError(null); }}
        onSave={(state) => void save(editing.id, state)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/configuracoes" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Automações</h1>
          <p className="text-sm text-muted-foreground">Fluxos automáticos de atendimento</p>
        </div>
        {isAdmin && tab === "automacoes" && (
          <button onClick={startNew} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Nova automação
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          Você pode visualizar as automações. Para criar ou editar, é necessária aprovação de um Admin.
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border shrink-0">
        <TabBtn active={tab === "automacoes"} onClick={() => setTab("automacoes")} icon={ListChecks}>Automações</TabBtn>
        <TabBtn active={tab === "execucoes"} onClick={() => setTab("execucoes")} icon={History}>Execuções</TabBtn>
      </div>

      {tab === "automacoes" ? (
        <div className="flex flex-col gap-2">
          {automations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma automação ainda.</p>
          ) : (
            automations.map((a) => (
              <div key={a.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.active ? "bg-primary/10" : "bg-muted"}`}>
                  <Zap className={`w-4 h-4 ${a.active ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                    {!a.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inativa</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type} · {a.actions.length} ação(ões) · {a.run_count} execução(ões)
                    {a.last_run ? ` · última: ${new Date(a.last_run.created_at).toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => void toggle(a)} title={a.active ? "Desativar" : "Ativar"}
                      className={`p-1.5 rounded hover:bg-accent ${a.active ? "text-green-600" : "text-muted-foreground"}`}>
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEdit(a)} className="p-1.5 text-muted-foreground hover:bg-accent rounded" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void remove(a)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <ExecucoesTab />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 text-sm px-3 py-2 border-b-2 -mb-px transition-colors ${active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      <Icon className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

// ---- Builder ----
function AutomationBuilder({
  initial, isNew, inboxes, agents, tags, error, onCancel, onSave,
}: {
  initial: BuilderState; isNew: boolean; inboxes: Option[]; agents: Option[]; tags: string[];
  error: string | null; onCancel: () => void; onSave: (s: BuilderState) => void;
}) {
  const [s, setS] = useState<BuilderState>(initial);
  const set = (patch: Partial<BuilderState>) => setS((prev) => ({ ...prev, ...patch }));

  const addAction = (type: string) => set({ actions: [...s.actions, { action_type: type, config: {} }] });
  const removeAction = (i: number) => set({ actions: s.actions.filter((_, idx) => idx !== i) });
  const moveAction = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= s.actions.length) return;
    const next = [...s.actions];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set({ actions: next });
  };
  const setActionConfig = (i: number, key: string, value: string) =>
    set({ actions: s.actions.map((a, idx) => (idx === i ? { ...a, config: { ...a.config, [key]: value } } : a)) });

  const valid = s.name.trim() && s.actions.length > 0 &&
    (s.trigger_type !== "keyword" || s.keyword.trim());

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onCancel} className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">{isNew ? "Nova automação" : "Editar automação"}</h1>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{error}</div>
      )}

      {/* 1. Gatilho */}
      <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">1. Gatilho</p>
        <Field label="Nome da automação">
          <input value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Boas-vindas WhatsApp"
            className={INPUT} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quando">
            <select value={s.trigger_type} onChange={(e) => set({ trigger_type: e.target.value })} className={INPUT}>
              {TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
            </select>
          </Field>
          <Field label="Plataforma">
            <select value={s.channel} onChange={(e) => set({ channel: e.target.value })} className={INPUT}>
              {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Canal (Inbox)">
          <select value={s.inboxId} onChange={(e) => set({ inboxId: e.target.value })} className={INPUT}>
            <option value="">Todos os canais</option>
            {inboxes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        {s.trigger_type === "keyword" && (
          <Field label="Palavra-chave (a mensagem deve conter)">
            <input value={s.keyword} onChange={(e) => set({ keyword: e.target.value })} placeholder="ex.: orçamento" className={INPUT} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={s.oncePerContact} onChange={(e) => set({ oncePerContact: e.target.checked })} />
          Disparar apenas uma vez por contato
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={s.useHours} onChange={(e) => set({ useHours: e.target.checked })} />
          Restringir por horário (America/São_Paulo)
        </label>
        {s.useHours && (
          <div className="flex items-center gap-2 flex-wrap pl-6">
            <input type="time" value={s.hoursStart} onChange={(e) => set({ hoursStart: e.target.value })} className={`${INPUT} w-28`} />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="time" value={s.hoursEnd} onChange={(e) => set({ hoursEnd: e.target.value })} className={`${INPUT} w-28`} />
            <label className="flex items-center gap-1.5 text-xs text-foreground ml-2">
              <input type="checkbox" checked={s.hoursOutside} onChange={(e) => set({ hoursOutside: e.target.checked })} />
              apenas FORA desse horário
            </label>
          </div>
        )}
      </section>

      {/* 2. Ações */}
      <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">2. Ações</p>
        {s.actions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma ação. Adicione abaixo.</p>}
        {s.actions.map((a, i) => {
          const Icon = ACTION_ICON[a.action_type] ?? Zap;
          return (
            <div key={i} className="border border-border rounded-md p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground flex-1">{i + 1}. {ACTION_LABELS[a.action_type]}</span>
                <button onClick={() => moveAction(i, -1)} disabled={i === 0} className="p-1 text-muted-foreground hover:bg-accent rounded disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveAction(i, 1)} disabled={i === s.actions.length - 1} className="p-1 text-muted-foreground hover:bg-accent rounded disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeAction(i)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {a.action_type === "send_message" && (
                <textarea value={a.config.message ?? ""} onChange={(e) => setActionConfig(i, "message", e.target.value)}
                  rows={3} placeholder="Mensagem a enviar…" className={`${INPUT} resize-none`} />
              )}
              {a.action_type === "add_tag" && (
                <>
                  <input list="tags-dl" value={a.config.tag ?? ""} onChange={(e) => setActionConfig(i, "tag", e.target.value)}
                    placeholder="Nome da etiqueta" className={INPUT} />
                  <datalist id="tags-dl">{tags.map((t) => <option key={t} value={t} />)}</datalist>
                </>
              )}
              {a.action_type === "assign_agent" && (
                <select value={a.config.user_id ?? ""} onChange={(e) => setActionConfig(i, "user_id", e.target.value)} className={INPUT}>
                  <option value="">Selecione o agente…</option>
                  {agents.map((ag) => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                </select>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2 flex-wrap">
          {ACTION_TYPES.map((t) => {
            const Icon = ACTION_ICON[t] ?? Zap;
            return (
              <button key={t} onClick={() => addAction(t)}
                className="flex items-center gap-1 text-[11px] border border-border rounded-md px-2 py-1 hover:bg-accent">
                <Icon className="w-3 h-3" /> {ACTION_LABELS[t]}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Revisão */}
      <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="text-sm font-semibold text-foreground">3. Revisão</p>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={s.active} onChange={(e) => set({ active: e.target.checked })} />
          Ativar automação ao salvar
        </label>
        <div className="flex items-center gap-2">
          <button onClick={() => onSave(s)} disabled={!valid}
            className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 disabled:opacity-40">
            {isNew ? "Criar automação" : "Salvar alterações"}
          </button>
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-2">Cancelar</button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// ---- Execuções ----
interface RunRow { id: string; automation_name: string; trigger: string; status: string; error: string | null; created_at: string }

function ExecucoesTab() {
  const [runs, setRuns] = useState<RunRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/v1/automations/runs?limit=50");
      const data = res.ok ? ((await res.json()).data as RunRow[]) : [];
      if (!cancelled) setRuns(data);
    })();
    return () => { cancelled = true; };
  }, []);

  if (runs === null) return <p className="text-sm text-muted-foreground py-6">Carregando…</p>;
  if (runs.length === 0) return <p className="text-sm text-muted-foreground text-center py-10">Nenhuma execução ainda.</p>;

  return (
    <div className="flex flex-col gap-1.5">
      {runs.map((r) => (
        <div key={r.id} className="bg-card border border-border rounded-md px-3 py-2 flex items-center gap-3 text-xs">
          <span className={`font-medium ${STATUS_STYLE[r.status] ?? "text-muted-foreground"}`}>{r.status}</span>
          <span className="text-foreground flex-1 truncate">{r.automation_name}</span>
          <span className="text-muted-foreground">{TRIGGER_LABELS[r.trigger] ?? r.trigger}</span>
          <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
        </div>
      ))}
    </div>
  );
}
