"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, Zap, Plus, Trash2, X } from "lucide-react";

interface Props {
  conversationId: string;
  onMessageSent: () => void;
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shared: boolean;
  owned: boolean;
}

export function MessageInput({ conversationId, onMessageSent }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: text,
          media_url: null,
          media_type: null,
        }),
      });

      if (res.ok) {
        setContent("");
        onMessageSent();
        textareaRef.current?.focus();
      }
    } finally {
      setSending(false);
    }
  }, [content, conversationId, onMessageSent, sending]);

  const [showReplies, setShowReplies] = useState(false);

  const insertReply = useCallback((text: string) => {
    setContent((prev) => (prev.trim() ? `${prev}\n${text}` : text));
    setShowReplies(false);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "/" && content === "") {
        e.preventDefault();
        setShowReplies(true);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend, content]
  );

  return (
    <div className="border-t border-border p-3 bg-card">
      <div className="flex items-end gap-2">
        <button
          className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Enviar arquivo (em breve)"
          disabled
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowReplies((v) => !v)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Respostas rápidas ( / )"
          >
            <Zap className="w-4 h-4" />
          </button>
          {showReplies && (
            <QuickReplyPicker onInsert={insertReply} onClose={() => setShowReplies(false)} />
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem... (Enter para enviar, / para respostas rápidas)"
          rows={1}
          className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-y-auto"
          style={{ minHeight: 40 }}
        />

        <button
          onClick={() => void handleSend()}
          disabled={!content.trim() || sending}
          className="flex-shrink-0 p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function QuickReplyPicker({
  onInsert,
  onClose,
}: {
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", content: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/quick-replies");
      if (res.ok) {
        const json = (await res.json()) as { data: QuickReply[] };
        setReplies(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    if (!form.title.trim() || !form.content.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim(), content: form.content.trim() }),
      });
      if (res.ok) {
        setForm({ title: "", content: "" });
        setCreating(false);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }, [form, busy, load]);

  const remove = useCallback(
    async (id: string) => {
      setReplies((prev) => prev.filter((r) => r.id !== id));
      await fetch(`/api/v1/quick-replies/${id}`, { method: "DELETE" });
    },
    []
  );

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute bottom-full mb-2 left-0 z-20 w-80 bg-card border border-border rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-foreground">Respostas rápidas</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCreating((v) => !v)}
              className="p-1 text-muted-foreground hover:text-foreground"
              title="Nova resposta"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {creating && (
          <div className="p-2 border-b border-border flex flex-col gap-1.5 bg-muted/30">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Título (ex.: Saudação)"
              className="text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Conteúdo da mensagem…"
              rows={3}
              className="text-xs bg-background border border-border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() => void create()}
              disabled={!form.title.trim() || !form.content.trim() || busy}
              className="self-end text-xs bg-primary text-primary-foreground rounded px-3 py-1 hover:opacity-90 disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto p-1.5 flex flex-col gap-1">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Carregando…</p>
          ) : replies.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma resposta rápida. Crie uma no +.
            </p>
          ) : (
            replies.map((r) => (
              <div
                key={r.id}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer"
                onClick={() => onInsert(r.content)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {r.title}
                    {r.shared && <span className="ml-1 text-[9px] text-muted-foreground">(equipe)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{r.content}</p>
                </div>
                {r.owned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(r.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive flex-shrink-0"
                    title="Excluir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
