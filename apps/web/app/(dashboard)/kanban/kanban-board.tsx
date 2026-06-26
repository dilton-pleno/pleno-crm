"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { X, Settings, Phone, Clock, Plus, Trash2, Check, Star } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { MessageTimeline } from "@/components/inbox/message-timeline";
import { MessageInput } from "@/components/inbox/message-input";
import { ChannelBadge } from "@/components/ui/channel-badge";
import type { Role } from "@pleno-crm/types";

interface BoardCard {
  id: string;
  conversation_id: string;
  contact: { id: string; name: string; avatar_url: string | null; phone: string | null };
  channel_type: string;
  last_message_preview: string | null;
  last_direction: "in" | "out" | null;
  last_activity_at: string;
  unread_count: number;
  time_in_stage_seconds: number;
  last_order: { status: string; total: number } | null;
  assigned_to: { id: string; name: string; avatar_url: string | null } | null;
}

interface PipelineSummary {
  id: string;
  name: string;
  is_default: boolean;
}

interface BoardStage {
  id: string;
  name: string;
  color: string;
  position: number;
  card_count: number;
  avg_time_seconds: number;
  cards: BoardCard[];
}

interface BoardData {
  pipeline: { id: string; name: string };
  stages: BoardStage[];
}

interface MessageItem {
  id: string;
  direction: "in" | "out";
  content: string | null;
  media_url: string | null;
  media_type: "image" | "audio" | "document" | "sticker" | "video" | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  sender: { id: string; name: string; type: "contact" | "agent" };
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function orderStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (/(pago|aprovad|entregue|conclu)/.test(s)) return "bg-green-500/10 text-green-600";
  if (/(cancel|estorn|recus|expir)/.test(s)) return "bg-red-500/10 text-red-600";
  return "bg-yellow-500/10 text-yellow-600";
}

interface Agent {
  id: string;
  name: string;
}

interface Props {
  pipelines: PipelineSummary[];
  initialPipelineId: string;
  agents: Agent[];
  currentUserId: string;
  currentUserRole: Role;
}

export function KanbanBoard({
  pipelines: initialPipelines,
  initialPipelineId,
  agents,
  currentUserId,
  currentUserRole,
}: Props) {
  const canManage = currentUserRole === "ADMIN" || currentUserRole === "GESTOR";
  const [pipelines, setPipelines] = useState<PipelineSummary[]>(initialPipelines);
  const [pipelineId, setPipelineId] = useState(initialPipelineId);
  const [manageOpen, setManageOpen] = useState(false);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);

  // Filtros
  const [agentFilter, setAgentFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");

  const refreshPipelines = useCallback(async () => {
    const res = await fetch("/api/v1/pipelines");
    if (res.ok) {
      const json = (await res.json()) as { data: PipelineSummary[] };
      setPipelines(json.data);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (agentFilter) p.set("agent_id", agentFilter);
    if (channelFilter) p.set("channel", channelFilter);
    if (fromFilter) p.set("from", new Date(fromFilter).toISOString());
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [agentFilter, channelFilter, fromFilter]);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/pipelines/${pipelineId}/board${query}`);
      if (res.ok) {
        const json = (await res.json()) as { data: BoardData };
        setBoard(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [pipelineId, query]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  useWebSocket({
    "card:moved": () => void fetchBoard(),
    "conversation:new": () => void fetchBoard(),
    "conversation:status_changed": () => void fetchBoard(),
  });

  const fetchMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/v1/conversations/${conversationId}/messages`);
    if (res.ok) {
      const json = (await res.json()) as { data: MessageItem[] };
      setMessages(json.data);
    }
  }, []);

  const handleSelect = useCallback(
    (card: BoardCard) => {
      setSelected(card);
      setMessages([]);
      void fetchMessages(card.conversation_id);
    },
    [fetchMessages]
  );

  const assignCard = useCallback(
    async (conversationId: string, userId: string | null) => {
      const res = await fetch(`/api/v1/conversations/${conversationId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        const agent = userId ? agents.find((a) => a.id === userId) ?? null : null;
        const assigned = agent ? { id: agent.id, name: agent.name, avatar_url: null } : null;
        setSelected((prev) => (prev ? { ...prev, assigned_to: assigned } : prev));
        void fetchBoard();
      }
    },
    [agents, fetchBoard]
  );

  const moveToPipeline = useCallback(
    async (cardId: string, targetPipelineId: string) => {
      const res = await fetch("/api/v1/pipelines");
      if (!res.ok) return;
      const json = (await res.json()) as {
        data: Array<{ id: string; first_stage_id: string | null }>;
      };
      const target = json.data.find((p) => p.id === targetPipelineId);
      if (!target?.first_stage_id) return;
      await fetch(`/api/v1/cards/${cardId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: target.first_stage_id }),
      });
      setSelected(null);
      void fetchBoard();
    },
    [fetchBoard]
  );

  const moveCardLocal = useCallback((cardId: string, toStageId: string) => {
    setBoard((prev) => {
      if (!prev) return prev;
      let moved: BoardCard | undefined;
      const stripped = prev.stages.map((s) => {
        const idx = s.cards.findIndex((c) => c.id === cardId);
        if (idx >= 0) {
          moved = s.cards[idx];
          return { ...s, cards: s.cards.filter((c) => c.id !== cardId), card_count: s.card_count - 1 };
        }
        return s;
      });
      if (!moved) return prev;
      const found = moved;
      return {
        ...prev,
        stages: stripped.map((s) =>
          s.id === toStageId ? { ...s, cards: [found, ...s.cards], card_count: s.card_count + 1 } : s
        ),
      };
    });
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const cardId = event.active.id as string;
      const card = board?.stages.flatMap((s) => s.cards).find((c) => c.id === cardId) ?? null;
      setActiveCard(card);
    },
    [board]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over) return;
      const cardId = active.id as string;
      const toStageId = over.id as string;
      const fromStageId = (active.data.current as { stageId?: string } | undefined)?.stageId;
      if (!fromStageId || fromStageId === toStageId) return;

      moveCardLocal(cardId, toStageId);
      const res = await fetch(`/api/v1/cards/${cardId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: toStageId }),
      });
      if (!res.ok) void fetchBoard();
    },
    [moveCardLocal, fetchBoard]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Carregando board...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Não foi possível carregar o pipeline.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filtros */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap">
        <select
          value={pipelineId}
          onChange={(e) => setPipelineId(e.target.value)}
          className="text-sm font-semibold text-foreground bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring mr-1"
        >
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_default ? " ★" : ""}
            </option>
          ))}
        </select>
        {canManage && (
          <button
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-1 text-xs bg-card border border-border rounded-md px-2 py-1.5 hover:bg-accent text-muted-foreground"
            title="Gerenciar pipelines"
          >
            <Settings className="w-3.5 h-3.5" /> Gerenciar
          </button>
        )}
        <span className="mx-1 w-px h-5 bg-border" />
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos os agentes</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todos os canais</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="messenger">Messenger</option>
        </select>
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          Criados a partir de
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        {(agentFilter || channelFilter || fromFilter) && (
          <button
            onClick={() => {
              setAgentFilter("");
              setChannelFilter("");
              setFromFilter("");
            }}
            className="text-xs text-primary hover:underline"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 p-4 h-full min-w-max">
            {board.stages.map((stage) => (
              <KanbanColumn key={stage.id} stage={stage} onSelectCard={handleSelect} />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? <CardContent card={activeCard} dragging /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Painel lateral da conversa */}
      {selected && (
        <ConversationDrawer
          card={selected}
          messages={messages}
          agents={agents}
          pipelines={pipelines}
          currentPipelineId={pipelineId}
          canAssignOthers={canManage}
          currentUserId={currentUserId}
          onAssign={(userId) => void assignCard(selected.conversation_id, userId)}
          onMoveToPipeline={(pid) => void moveToPipeline(selected.id, pid)}
          onClose={() => setSelected(null)}
          onMessageSent={() => void fetchMessages(selected.conversation_id)}
        />
      )}

      {/* Gerência de pipelines (ADMIN/GESTOR) */}
      {manageOpen && (
        <PipelineManager
          pipelines={pipelines}
          currentPipelineId={pipelineId}
          onClose={() => setManageOpen(false)}
          onChanged={async (nextSelected) => {
            await refreshPipelines();
            if (nextSelected) setPipelineId(nextSelected);
          }}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  stage,
  onSelectCard,
}: {
  stage: BoardStage;
  onSelectCard: (card: BoardCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col w-72 flex-shrink-0 bg-muted/40 rounded-lg max-h-full">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-semibold text-foreground flex-1 truncate">{stage.name}</span>
        <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
          {stage.card_count}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
      >
        {stage.cards.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-4">Sem cards</p>
        )}
        {stage.cards.map((card) => (
          <KanbanCard key={card.id} card={card} stageId={stage.id} onSelect={onSelectCard} />
        ))}
      </div>

      {/* Rodapé com métricas */}
      <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
        <span>{stage.card_count} card(s)</span>
        <span>Permanência média: {formatDuration(stage.avg_time_seconds)}</span>
      </div>
    </div>
  );
}

function KanbanCard({
  card,
  stageId,
  onSelect,
}: {
  card: BoardCard;
  stageId: string;
  onSelect: (card: BoardCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { stageId },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(card)}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <CardContent card={card} />
    </div>
  );
}

function CardContent({ card, dragging }: { card: BoardCard; dragging?: boolean }) {
  const waitingMin =
    card.last_direction === "in"
      ? Math.floor((Date.now() - new Date(card.last_activity_at).getTime()) / 60000)
      : null;

  return (
    <div
      className={`bg-card border border-border rounded-lg p-3 ${
        dragging ? "shadow-lg rotate-2" : "hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
            {card.contact.name.charAt(0).toUpperCase()}
          </div>
          <ChannelBadge type={card.channel_type} size={14} className="absolute -bottom-0.5 -right-0.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-foreground truncate flex-1">{card.contact.name}</p>
            {card.unread_count > 0 && (
              <span className="flex-shrink-0 bg-orange-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {card.unread_count > 9 ? "9+" : card.unread_count}
              </span>
            )}
          </div>
          {card.contact.phone && (
            <p className="text-[10px] text-muted-foreground truncate">{card.contact.phone}</p>
          )}
          <p className="text-[11px] text-muted-foreground truncate">
            {card.last_message_preview ?? "Sem mensagens"}
          </p>
        </div>
      </div>

      {/* Último pedido (Wbuy) */}
      {card.last_order && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px]">
          <span className={`rounded-full px-1.5 py-0.5 ${orderStatusColor(card.last_order.status)}`}>
            {card.last_order.status}
          </span>
          <span className="text-foreground font-medium">{fmtCurrency(card.last_order.total)}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground min-w-0">
          <span className="flex items-center gap-0.5" title="Tempo no estágio">
            <Clock className="w-2.5 h-2.5" /> {formatDuration(card.time_in_stage_seconds)}
          </span>
          {waitingMin !== null && waitingMin >= 60 && (
            <span
              className={`flex items-center gap-0.5 font-medium ${
                waitingMin >= 180 ? "text-red-600" : "text-orange-600"
              }`}
              title="Aguardando resposta"
            >
              <Clock className="w-2.5 h-2.5" /> aguardando
            </span>
          )}
        </div>
        {card.assigned_to && (
          <span
            className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-medium text-foreground flex-shrink-0"
            title={card.assigned_to.name}
          >
            {card.assigned_to.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

function ConversationDrawer({
  card,
  messages,
  agents,
  pipelines,
  currentPipelineId,
  canAssignOthers,
  currentUserId,
  onAssign,
  onMoveToPipeline,
  onClose,
  onMessageSent,
}: {
  card: BoardCard;
  messages: MessageItem[];
  agents: Agent[];
  pipelines: PipelineSummary[];
  currentPipelineId: string;
  canAssignOthers: boolean;
  currentUserId: string;
  onAssign: (userId: string | null) => void;
  onMoveToPipeline: (pipelineId: string) => void;
  onClose: () => void;
  onMessageSent: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background border-l border-border flex flex-col h-full shadow-xl">
        <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              {card.contact.name.charAt(0).toUpperCase()}
            </div>
            <ChannelBadge type={card.channel_type} size={14} className="absolute -bottom-0.5 -right-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{card.contact.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{card.channel_type}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Atribuição + mover de pipeline (ADMIN/GESTOR) */}
        {canAssignOthers && (
          <div className="px-4 py-2 border-b border-border bg-card flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">Agente:</span>
              <select
                value={card.assigned_to?.id ?? ""}
                onChange={(e) => onAssign(e.target.value || null)}
                className="flex-1 text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Não atribuída</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.id === currentUserId ? " (eu)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {pipelines.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-14">Pipeline:</span>
                <select
                  value={currentPipelineId}
                  onChange={(e) => {
                    if (e.target.value !== currentPipelineId) onMoveToPipeline(e.target.value);
                  }}
                  className="flex-1 text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <MessageTimeline messages={messages} />
        <MessageInput conversationId={card.conversation_id} onMessageSent={onMessageSent} />
      </div>
    </div>
  );
}

function PipelineManager({
  pipelines,
  currentPipelineId,
  onClose,
  onChanged,
}: {
  pipelines: PipelineSummary[];
  currentPipelineId: string;
  onClose: () => void;
  onChanged: (nextSelected?: string) => void | Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (res.ok) {
        setNewName("");
        await onChanged(json.data.id as string);
      } else {
        setError(json.error?.message ?? "Falha ao criar pipeline");
      }
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch(`/api/v1/pipelines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await onChanged();
    else setError((await res.json()).error?.message ?? "Falha ao atualizar");
  };

  const remove = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/v1/pipelines/${id}`, { method: "DELETE" });
    if (res.ok) {
      const next = id === currentPipelineId ? pipelines.find((p) => p.id !== id)?.id : undefined;
      await onChanged(next);
    } else {
      setError((await res.json()).error?.message ?? "Falha ao excluir");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-xl flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Gerenciar pipelines</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {pipelines.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border border-border rounded-md px-2.5 py-2">
              <button
                onClick={() => !p.is_default && void patch(p.id, { is_default: true })}
                title={p.is_default ? "Pipeline padrão" : "Definir como padrão"}
                className={p.is_default ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
              >
                <Star className="w-4 h-4" fill={p.is_default ? "currentColor" : "none"} />
              </button>
              {editingId === p.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    className="flex-1 text-sm bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={async () => {
                      if (editingName.trim()) await patch(p.id, { name: editingName.trim() });
                      setEditingId(null);
                    }}
                    className="p-1 text-green-600 hover:bg-accent rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-accent rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(p.id);
                    setEditingName(p.name);
                  }}
                  className="flex-1 text-left text-sm font-medium text-foreground hover:underline"
                >
                  {p.name}
                </button>
              )}
              {!p.is_default && (
                <button
                  onClick={() => void remove(p.id)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  title="Excluir pipeline"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            placeholder="Nome do novo pipeline…"
            className="flex-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => void create()}
            disabled={!newName.trim() || busy}
            className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Criar
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Pipelines novos vêm com estágios padrão. O pipeline ★ recebe as conversas novas.
          Edite os estágios em Configurações → Pipeline.
        </p>
      </div>
    </div>
  );
}
