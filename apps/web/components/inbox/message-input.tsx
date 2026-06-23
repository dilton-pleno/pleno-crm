"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip } from "lucide-react";

interface Props {
  conversationId: string;
  onMessageSent: () => void;
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
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

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem... (Enter para enviar)"
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
