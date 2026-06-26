"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  subscribed: boolean;
  signup_date: string | null;
}

const PER_PAGE = 20;

function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function NewsletterClient() {
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
      if (search) qs.set("search", search);
      const res = await fetch(`/api/v1/ecommerce/newsletter?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as {
          data: Subscriber[];
          meta: { total: number; active: number };
        };
        setSubs(json.data);
        setTotal(json.meta.total);
        setActive(json.meta.active);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void fetchSubs();
  }, [fetchSubs]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/ecommerce" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Newsletter</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">Inscritos</span>
            <span className="text-base font-semibold text-foreground">{fmtNumber(total)}</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-muted-foreground">Ativos (opt-in)</span>
            <span className="text-base font-semibold text-foreground">{fmtNumber(active)}</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden shrink-0">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">
            Inscritos <span className="text-muted-foreground font-normal">({fmtNumber(total)})</span>
          </h2>
          <div className="flex items-center gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              placeholder="Buscar por e-mail ou nome…"
              className="text-xs bg-background border border-border rounded-md px-3 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-ring"
            />
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
        </div>
        {loading && subs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {search
              ? "Nenhum inscrito encontrado."
              : "Nenhum inscrito. Use “Sincronizar newsletter” em Configurações → Integrações."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2">E-mail</th>
                  <th className="text-left font-medium px-3 py-2">Nome</th>
                  <th className="text-center font-medium px-3 py-2">Status</th>
                  <th className="text-right font-medium px-4 py-2">Inscrição</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2 text-foreground">{s.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.name ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                          s.subscribed ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.subscribed ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {s.signup_date ? new Date(s.signup_date).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
