"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";

interface ContactItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  channels: Array<{ id: string; channel_type: string }>;
  last_interaction_at: string | null;
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "WA",
  instagram: "IG",
  messenger: "ME",
  email: "EM",
  site: "SI",
};

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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/v1/contacts${params}`);
      if (res.ok) {
        const json = (await res.json()) as { data: ContactItem[] };
        setContacts(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Busca com debounce.
  useEffect(() => {
    const t = setTimeout(() => void fetchContacts(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchContacts]);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-4xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-foreground">Contatos</h1>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="w-full pl-10 pr-3 py-2 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Users className="w-8 h-8" />
          <p className="text-sm">Nenhum contato encontrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {contacts.map((c) => (
            <Link
              key={c.id}
              href={`/contatos/${c.id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.phone ?? c.email ?? "Sem contato"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {c.channels.map((ch) => (
                  <span
                    key={ch.id}
                    className="text-[9px] bg-accent text-foreground rounded px-1 py-0.5 leading-none"
                    title={ch.channel_type}
                  >
                    {CHANNEL_ICONS[ch.channel_type] ?? "??"}
                  </span>
                ))}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 w-20 text-right">
                {formatDate(c.last_interaction_at)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
