"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Search, MessageCircle } from "lucide-react";

type FilterTab = "all" | "mine" | "unassigned";

interface ConversationItem {
  id: string;
  contact: { id: string; name: string; avatar_url: string | null };
  last_message: { content: string | null; direction: "in" | "out"; sent_at: string } | null;
  unread_count: number;
  status: "open" | "pending" | "resolved";
  channel_type: string;
  assigned_to: { id: string; name: string } | null;
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "WA",
  instagram: "IG",
  messenger: "ME",
  email: "EM",
  site: "SI",
};

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

interface Props {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: string;
}

export function ConversationList({ conversations, selectedId, onSelect, currentUserId }: Props) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((c) => {
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
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <MessageCircle className="w-6 h-6" />
            <p className="text-xs">Nenhuma conversa</p>
          </div>
        )}

        {filtered.map((conv) => (
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
                <span className="absolute -bottom-0.5 -right-0.5 text-[9px] bg-green-500 text-white rounded px-0.5 leading-none py-0.5">
                  {CHANNEL_ICONS[conv.channel_type] ?? "??"}
                </span>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-foreground truncate">{conv.contact.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {conv.last_message ? formatTime(conv.last_message.sent_at) : ""}
                  </span>
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
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
