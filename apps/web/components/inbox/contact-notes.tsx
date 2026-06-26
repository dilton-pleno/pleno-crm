"use client";

import { useState, useEffect, useCallback } from "react";
import { StickyNote, Trash2, Send } from "lucide-react";

interface Note {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; name: string };
  owned: boolean;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Notas internas do contato (visíveis só para a equipe). Usado no painel do
 * atendimento e na ficha do contato. As notas refletem no mesmo contato em
 * qualquer um dos lugares.
 */
export function ContactNotes({ contactId, compact = false }: { contactId: string; compact?: boolean }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/contacts/${contactId}/notes`);
    if (res.ok) {
      const json = (await res.json()) as { data: Note[] };
      setNotes(json.data);
    } else {
      setNotes([]);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async () => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: Note };
        setNotes((prev) => [json.data, ...(prev ?? [])]);
        setText("");
      }
    } finally {
      setBusy(false);
    }
  }, [text, busy, contactId]);

  const remove = useCallback(
    async (noteId: string) => {
      setNotes((prev) => (prev ? prev.filter((n) => n.id !== noteId) : prev));
      await fetch(`/api/v1/contacts/${contactId}/notes/${noteId}`, { method: "DELETE" });
    },
    [contactId]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void add();
          }}
          placeholder="Adicionar nota interna… (Ctrl+Enter)"
          rows={compact ? 2 : 3}
          className="flex-1 resize-none text-xs bg-background border border-border rounded-md px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={() => void add()}
          disabled={!text.trim() || busy}
          className="flex-shrink-0 p-2 bg-primary text-primary-foreground rounded-md disabled:opacity-40 hover:opacity-90"
          title="Salvar nota"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {notes === null ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : notes.length === 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
          <StickyNote className="w-3.5 h-3.5" /> Nenhuma nota ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="group bg-muted/40 border border-border rounded-md px-2.5 py-2">
              <p className="text-xs text-foreground whitespace-pre-wrap">{n.content}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">
                  {n.author.name} · {formatWhen(n.created_at)}
                </span>
                {n.owned && (
                  <button
                    onClick={() => void remove(n.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive"
                    title="Excluir nota"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
