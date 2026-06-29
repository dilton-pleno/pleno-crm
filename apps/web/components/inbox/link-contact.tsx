"use client";

import { useState, useEffect, useCallback } from "react";
import { Link2, Search, X } from "lucide-react";

interface Result {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/**
 * Botão + modal para vincular (mesclar) o contato atual da conversa a outro
 * contato já existente, buscando por CPF ou WhatsApp. Útil principalmente no
 * Messenger, onde o contato chega só com o ID interno. O contato atual é a
 * ORIGEM, mesclada no contato escolhido (destino).
 */
export function LinkContact({ contactId, onLinked }: { contactId: string; onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/contacts?search=${encodeURIComponent(q)}&limit=10`);
        if (res.ok) {
          const json = (await res.json()) as { data: Result[] };
          if (!cancelled) setResults(json.data.filter((c) => c.id !== contactId));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, open, contactId]);

  const link = useCallback(
    async (targetId: string) => {
      setLinking(targetId);
      try {
        const res = await fetch(`/api/v1/contacts/${targetId}/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_contact_id: contactId }),
        });
        if (res.ok) {
          setOpen(false);
          setSearch("");
          setResults([]);
          onLinked();
        }
      } finally {
        setLinking(null);
      }
    },
    [contactId, onLinked]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-1.5 text-xs bg-accent hover:bg-accent/80 text-foreground rounded-md transition-colors flex items-center justify-center gap-1"
      >
        <Link2 className="w-3 h-3" /> Vincular a outro contato
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-xl flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Vincular a outro contato</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Busque o contato por <strong>CPF</strong> ou <strong>WhatsApp</strong>. O histórico desta
              conversa será unificado no contato escolhido.
            </p>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                placeholder="CPF ou WhatsApp…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Buscando…</p>
              ) : search.trim().length < 2 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Digite ao menos 2 caracteres.</p>
              ) : results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum contato encontrado.</p>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => void link(c.id)}
                    disabled={linking !== null}
                    className="flex items-center gap-2 text-left px-2.5 py-2 rounded-md hover:bg-accent disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.phone ?? c.email ?? "—"}
                      </p>
                    </div>
                    {linking === c.id && <span className="text-[10px] text-muted-foreground">vinculando…</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
