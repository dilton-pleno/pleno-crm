"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Check, CheckCheck, FileText, Volume2 } from "lucide-react";

interface MessageItem {
  id: string;
  direction: "in" | "out";
  content: string | null;
  media_url: string | null;
  media_type: "image" | "audio" | "document" | "sticker" | "video" | null;
  media_file_name?: string | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  sender: { id: string; name: string; type: "contact" | "agent" };
}

function groupByDate(messages: MessageItem[]): Array<{ date: string; messages: MessageItem[] }> {
  const groups: Record<string, MessageItem[]> = {};
  for (const msg of messages) {
    const d = new Date(msg.sent_at).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    if (!groups[d]) groups[d] = [];
    groups[d].push(msg);
  }
  return Object.entries(groups).map(([date, msgs]) => ({ date, messages: msgs }));
}

function MessageStatus({ msg }: { msg: MessageItem }) {
  if (msg.direction !== "out") return null;
  if (msg.read_at) return <CheckCheck className="w-3 h-3 text-blue-400" />;
  if (msg.delivered_at) return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
  return <Check className="w-3 h-3 text-muted-foreground" />;
}

function MediaContent({ msg }: { msg: MessageItem }) {
  if (!msg.media_url) return null;

  if (msg.media_type === "image" || msg.media_type === "sticker") {
    return (
      <div className="mt-1 rounded overflow-hidden max-w-[220px]">
        <Image
          src={msg.media_url}
          alt="imagem"
          width={220}
          height={200}
          className="object-cover rounded"
          unoptimized
        />
      </div>
    );
  }

  if (msg.media_type === "video") {
    return (
      <div className="mt-1 rounded overflow-hidden max-w-[260px]">
        <video controls src={msg.media_url} className="rounded max-h-[260px] w-full" />
      </div>
    );
  }

  if (msg.media_type === "audio") {
    return (
      <div className="flex items-center gap-2 mt-1 bg-black/10 rounded-lg px-3 py-2">
        <Volume2 className="w-4 h-4" />
        <audio controls src={msg.media_url} className="h-8 max-w-[180px]" />
      </div>
    );
  }

  if (msg.media_type === "document") {
    return (
      <a
        href={msg.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-1 bg-black/10 rounded-lg px-3 py-2 text-sm hover:bg-black/20 transition-colors"
      >
        <FileText className="w-4 h-4 flex-shrink-0" />
        <span className="truncate max-w-[200px]">
          {msg.media_file_name ?? msg.content ?? "Documento"}
        </span>
      </a>
    );
  }

  return null;
}

interface Props {
  messages: MessageItem[];
}

export function MessageTimeline({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Nenhuma mensagem ainda
      </div>
    );
  }

  const groups = groupByDate(messages);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.date}>
          {/* Separador de data */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground px-2 flex-shrink-0">{group.date}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Mensagens do dia */}
          <div className="flex flex-col gap-1">
            {group.messages.map((msg) => {
              const isOut = msg.direction === "out";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOut ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 ${
                      isOut
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none"
                    }`}
                  >
                    {!isOut && (
                      <p className="text-[10px] font-medium mb-1 opacity-70">{msg.sender.name}</p>
                    )}
                    <MediaContent msg={msg} />
                    {msg.content && (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : ""}`}>
                      <span className="text-[10px] opacity-60">
                        {new Date(msg.sent_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <MessageStatus msg={msg} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
