"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { ChannelBadge } from "@/components/ui/channel-badge";

interface ContactItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  uf: string | null;
  channels: Array<{ id: string; channel_type: string }>;
  last_interaction_at: string | null;
}

const PER_PAGE = 30;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ContatosClient() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(p), limit: String(PER_PAGE) });
      if (q) qs.set("search", q);
      const res = await fetch(`/api/v1/contacts?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as { data: ContactItem[]; meta: { total: number } };
        setContacts(json.data);
        setTotal(json.meta.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Busca com debounce; volta para a página 1 a cada nova busca.
  useEffect(() => {
    const t = setTimeout(() => void fetchContacts(search, page), 300);
    return () => clearTimeout(t);
  }, [search, page, fetchContacts]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h1 className="text-lg font-semibold text-foreground">
          Contatos <span className="text-muted-foreground font-normal text-sm">({total.toLocaleString("pt-BR")})</span>
        </h1>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs border border-border rounded-md px-2 py-1.5 hover:bg-accent disabled:opacity-40"
            >
              ‹
            </button>
            <span className="text-xs text-muted-foreground px-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-xs border border-border rounded-md px-2 py-1.5 hover:bg-accent disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Busca */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="w-full pl-10 pr-3 py-2 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Grid de cards */}
      {loading && contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Users className="w-8 h-8" />
          <p className="text-sm">Nenhum contato encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {contacts.map((c) => (
            <Link
              key={c.id}
              href={`/contatos/${c.id}`}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.phone ?? c.email ?? "Sem contato"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">
                  {c.city ? `${c.city}${c.uf ? `/${c.uf}` : ""}` : formatDate(c.last_interaction_at)}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {c.channels.map((ch) => (
                    <ChannelBadge key={ch.id} type={ch.channel_type} size={16} />
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
