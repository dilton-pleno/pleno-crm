"use client";

import { useState, useCallback } from "react";
import { Search, MessageCircle, Clock } from "lucide-react";
import { ChannelBadge, ChannelIcon } from "@/components/ui/channel-badge";
import { getChannelMeta, FILTERABLE_CHANNELS } from "@/lib/channels";
import { TagChip, type TagData } from "@/components/ui/tag-chip";

type FilterTab = "all" | "mine" | "unassigned";

interface ConversationItem {
  id: string;
  contact: { id: string; name: string; avatar_url: string | null };
  tags: TagData[];
  last_message: { content: string | null; direction: "in" | "out"; sent_at: string } | null;
  unread_count: number;
  status: "open" | "pending" | "resolved";
  channel_type: string;
  assigned_to: { id: string; name: string } | null;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffH < 24) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// SLA de primeira resposta: conversa aberta cuja última mensagem é do cliente.
const SLA_WARN_MIN = 60; // 1h
const SLA_CRIT_MIN = 180; // 3h

function slaWaitingMinutes(conv: ConversationItem): number | null {
  if (conv.status !== "open") return null;
  if (!conv.last_message || conv.last_message.direction !== "in") return null;
  const mins = Math.floor((Date.now() - new Date(conv.last_message.sent_at).getTime()) / 60000);
  return mins;
}

function formatWaiting(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Props {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: string;
}

export function ConversationList({ conversations, selectedId, onSelect, currentUserId }: Props) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [search, setSearch] = useState("");

  // Etiquetas presentes nas conversas carregadas (para o filtro).
  const availableTags = Array.from(
    new Map(conversations.flatMap((c) => c.tags).map((t) => [t.id, t])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = conversations.filter((c) => {
    if (channelFilter && c.channel_type !== channelFilter) return false;
    if (tagFilter && !c.tags.some((t) => t.id === tagFilter)) return false;
    if (waitingOnly && (slaWaitingMinutes(c) ?? 0) < SLA_WARN_MIN) return false;
    if (tab === "mine" && c.assigned_to?.id !== currentUserId) return false;
    if (tab === "unassigned" && c.assigned_to !== null) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.contact.name.toLowerCase().includes(q) ||
        (c.last_message?.content?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  return (
    <div className="flex flex-col h-full border-r border-border bg-card" style={{ width: 280, minWidth: 280 }}>
      {/* Cabeçalho */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground mb-2">Conversas</h2>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Buscar..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Filtro por canal */}
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={() => setChannelFilter(null)}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              channelFilter === null
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Todos
          </button>
          {FILTERABLE_CHANNELS.map((ch) => {
            const active = channelFilter === ch;
            const meta = getChannelMeta(ch);
            return (
              <button
                key={ch}
                onClick={() => setChannelFilter(active ? null : ch)}
                title={meta.label}
                className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                  active ? "ring-2 ring-offset-1 ring-offset-card" : "hover:bg-accent opacity-70 hover:opacity-100"
                }`}
                style={active ? { backgroundColor: `${meta.color}1a`, boxShadow: `0 0 0 2px ${meta.color}` } : undefined}
              >
                <ChannelIcon type={ch} size={15} />
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex gap-1 mt-2">
          {(["all", "mine", "unassigned"] as FilterTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1 text-xs rounded-md transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t === "all" ? "Todas" : t === "mine" ? "Minhas" : "Sem agente"}
            </button>
          ))}
        </div>

        {/* SLA: aguardando resposta */}
        <button
          onClick={() => setWaitingOnly((v) => !v)}
          className={`mt-1.5 w-full flex items-center justify-center gap-1 py-1 text-xs rounded-md transition-colors ${
            waitingOnly
              ? "bg-orange-500/15 text-orange-600"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <Clock className="w-3 h-3" /> Aguardando resposta
        </button>

        {/* Filtro por etiqueta */}
        {availableTags.length > 0 && (
          <select
            value={tagFilter ?? ""}
            onChange={(e) => setTagFilter(e.target.value || null)}
            className="mt-1.5 w-full text-xs bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring text-muted-foreground"
          >
            <option value="">Todas as etiquetas</option>
            {availableTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <MessageCircle className="w-6 h-6" />
            <p className="text-xs">Nenhuma conversa</p>
          </div>
        )}

        {filtered.map((conv) => {
          const waiting = slaWaitingMinutes(conv);
          return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-3 border-b border-border hover:bg-accent/50 transition-colors ${
              selectedId === conv.id ? "bg-accent" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                  {conv.contact.name.charAt(0).toUpperCase()}
                </div>
                <ChannelBadge
                  type={conv.channel_type}
                  className="absolute -bottom-0.5 -right-0.5"
                />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-foreground truncate">{conv.contact.name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {waiting !== null && waiting >= SLA_WARN_MIN && (
                      <span
                        className={`flex items-center gap-0.5 text-[9px] font-medium ${
                          waiting >= SLA_CRIT_MIN ? "text-red-600" : "text-orange-600"
                        }`}
                        title={`Aguardando resposta há ${formatWaiting(waiting)}`}
                      >
                        <Clock className="w-2.5 h-2.5" /> {formatWaiting(waiting)}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {conv.last_message ? formatTime(conv.last_message.sent_at) : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.last_message
                      ? (conv.last_message.direction === "out" ? "Você: " : "") +
                        (conv.last_message.content ?? "[mídia]")
                      : "Sem mensagens"}
                  </p>
                  {conv.unread_count > 0 && (
                    <span className="flex-shrink-0 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                      {conv.unread_count > 9 ? "9+" : conv.unread_count}
                    </span>
                  )}
                </div>
                {conv.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conv.tags.map((t) => (
                      <TagChip key={t.id} tag={t} size="xs" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}
