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
import { X } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { MessageTimeline } from "@/components/inbox/message-timeline";
import { MessageInput } from "@/components/inbox/message-input";

interface BoardCard {
  id: string;
  conversation_id: string;
  contact: { id: string; name: string; avatar_url: string | null };
  channel_type: string;
  last_message_preview: string | null;
  last_activity_at: string;
  assigned_to: { id: string; name: string; avatar_url: string | null } | null;
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

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "WA",
  instagram: "IG",
  messenger: "ME",
  email: "EM",
  site: "SI",
};

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

interface Agent {
  id: string;
  name: string;
}

interface Props {
  pipelineId: string;
  agents: Agent[];
}

export function KanbanBoard({ pipelineId, agents }: Props) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [selected, setSelected] = useState<BoardCard | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);

  // Filtros
  const [agentFilter, setAgentFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");

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
        <h1 className="text-sm font-semibold text-foreground mr-2">{board.pipeline.name}</h1>
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
          onClose={() => setSelected(null)}
          onMessageSent={() => void fetchMessages(selected.conversation_id)}
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
          <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-green-500 text-white rounded px-0.5 leading-none py-0.5">
            {CHANNEL_ICONS[card.channel_type] ?? "??"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{card.contact.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {card.last_message_preview ?? "Sem mensagens"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground">{formatRelative(card.last_activity_at)}</span>
        {card.assigned_to && (
          <span
            className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[9px] font-medium text-foreground"
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
  onClose,
  onMessageSent,
}: {
  card: BoardCard;
  messages: MessageItem[];
  onClose: () => void;
  onMessageSent: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background border-l border-border flex flex-col h-full shadow-xl">
        <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
            {card.contact.name.charAt(0).toUpperCase()}
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

        <MessageTimeline messages={messages} />
        <MessageInput conversationId={card.conversation_id} onMessageSent={onMessageSent} />
      </div>
    </div>
  );
}
