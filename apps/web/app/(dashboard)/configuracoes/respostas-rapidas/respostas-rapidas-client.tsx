"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Check, X, Pencil, Users } from "lucide-react";

interface Reply {
  id: string;
  title: string;
  content: string;
  shared: boolean;
  owned: boolean;
}

export function RespostasRapidasClient({ initialReplies }: { initialReplies: Reply[] }) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [form, setForm] = useState({ title: "", content: "", shared: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", shared: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sortReplies = (list: Reply[]) => [...list].sort((a, b) => a.title.localeCompare(b.title));

  const create = useCallback(async () => {
    if (!form.title.trim() || !form.content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), content: form.content.trim(), shared: form.shared }),
      });
      const json = await res.json();
      if (res.ok) {
        setReplies((prev) => sortReplies([...prev, json.data as Reply]));
        setForm({ title: "", content: "", shared: false });
      } else {
        setError(json.error?.message ?? "Falha ao criar resposta");
      }
    } finally {
      setBusy(false);
    }
  }, [form, busy]);

  const saveEdit = useCallback(
    async (id: string) => {
      if (!editForm.title.trim() || !editForm.content.trim()) return;
      setReplies((prev) =>
        sortReplies(prev.map((r) => (r.id === id ? { ...r, ...editForm } : r)))
      );
      setEditingId(null);
      await fetch(`/api/v1/quick-replies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title.trim(),
          content: editForm.content.trim(),
          shared: editForm.shared,
        }),
      });
    },
    [editForm]
  );

  const remove = useCallback(async (id: string) => {
    if (!confirm("Excluir esta resposta rápida?")) return;
    setReplies((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/v1/quick-replies/${id}`, { method: "DELETE" });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/configuracoes" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Respostas rápidas</h1>
          <p className="text-sm text-muted-foreground">Mensagens prontas para o atendimento</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Nova resposta */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 shrink-0">
        <p className="text-sm font-semibold text-foreground">Nova resposta</p>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Título (ex.: Saudação inicial)"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          placeholder="Conteúdo da mensagem…"
          rows={3}
          className="text-sm bg-background border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={form.shared}
            onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))}
          />
          <Users className="w-3.5 h-3.5" /> Compartilhar com a equipe
        </label>
        <button
          onClick={() => void create()}
          disabled={!form.title.trim() || !form.content.trim() || busy}
          className="self-start flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Criar resposta
        </button>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {replies.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma resposta rápida ainda.</p>
        ) : (
          replies.map((r) =>
            editingId === r.id ? (
              <div key={r.id} className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="text-sm bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                  rows={3}
                  className="text-sm bg-background border border-border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={editForm.shared}
                      onChange={(e) => setEditForm((f) => ({ ...f, shared: e.target.checked }))}
                    />
                    Compartilhada
                  </label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => void saveEdit(r.id)} className="p-1.5 text-green-600 hover:bg-accent rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:bg-accent rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={r.id} className="bg-card border border-border rounded-lg p-3 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {r.title}
                    {r.shared && (
                      <span className="ml-2 text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> equipe
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{r.content}</p>
                </div>
                {r.owned && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(r.id);
                        setEditForm({ title: r.title, content: r.content, shared: r.shared });
                      }}
                      className="p-1.5 text-muted-foreground hover:bg-accent rounded"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void remove(r.id)}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
