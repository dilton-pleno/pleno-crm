"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Phone, Mail, CheckCircle, Clock, ExternalLink, Link2 } from "lucide-react";
import { OrderHistory } from "./order-history";
import { ChannelIcon } from "@/components/ui/channel-badge";
import type { Role } from "@pleno-crm/types";

interface Channel {
  id: string;
  channelType: string;
  channelIdentifier: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  notes: string | null;
  channels: Channel[];
}

interface ConversationMeta {
  id: string;
  status: "open" | "pending" | "resolved";
  assignedTo: { id: string; name: string } | null;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  email: "E-mail",
  site: "Site",
};

interface LinkSuggestion {
  contact_id: string;
  name: string;
  channels: Array<{ channel_type: string; channel_identifier: string }>;
}

interface Agent {
  id: string;
  name: string;
}

interface Props {
  contact: Contact | null;
  conversation: ConversationMeta | null;
  onResolve: () => void;
  onPending: () => void;
  onAssignMe: () => void;
  onAssign?: (userId: string | null) => void;
  onLinked?: () => void;
  canLink?: boolean;
  currentUserId: string;
  currentUserRole: Role;
  agents?: Agent[];
}

export function ContactPanel({
  contact,
  conversation,
  onResolve,
  onPending,
  onAssignMe,
  onAssign,
  onLinked,
  canLink = false,
  currentUserId,
  currentUserRole,
  agents = [],
}: Props) {
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  const contactId = contact?.id ?? null;

  useEffect(() => {
    if (!contactId || !canLink) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/contacts/${contactId}/link-suggestions`);
        if (res.ok) {
          const json = (await res.json()) as { data: LinkSuggestion[] };
          if (!cancelled) setSuggestions(json.data);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactId, canLink]);

  const handleLink = useCallback(
    async (sourceId: string) => {
      if (!contactId) return;
      setLinking(sourceId);
      try {
        const res = await fetch(`/api/v1/contacts/${contactId}/merge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_contact_id: sourceId }),
        });
        if (res.ok) {
          setSuggestions((s) => s.filter((sug) => sug.contact_id !== sourceId));
          onLinked?.();
        }
      } finally {
        setLinking(null);
      }
    },
    [contactId, onLinked]
  );

  if (!contact || !conversation) {
    return (
      <div
        className="flex items-center justify-center h-full border-l border-border text-sm text-muted-foreground bg-card"
        style={{ width: 320, minWidth: 320 }}
      >
        Selecione uma conversa
      </div>
    );
  }

  const isAssignedToMe = conversation.assignedTo?.id === currentUserId;
  const canAssignOthers = currentUserRole === "ADMIN" || currentUserRole === "GESTOR";

  return (
    <div
      className="flex flex-col h-full border-l border-border bg-card overflow-y-auto"
      style={{ width: 320, minWidth: 320 }}
    >
      {/* Perfil do contato */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold flex-shrink-0">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{contact.name}</p>
            {contact.phone && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Phone className="w-3 h-3" /> {contact.phone}
              </p>
            )}
            {contact.email && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Mail className="w-3 h-3" /> {contact.email}
              </p>
            )}
          </div>
        </div>

        <Link
          href={`/contatos/${contact.id}`}
          className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Ver perfil completo
        </Link>
      </div>

      {/* Ações de conversa */}
      <div className="p-4 border-b border-border flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Conversa
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Agente:</span>
          <span className="text-foreground">
            {conversation.assignedTo?.name ?? "Não atribuída"}
          </span>
        </div>

        {/* ADMIN/GESTOR atribuem a qualquer agente */}
        {canAssignOthers && onAssign && (
          <select
            value={conversation.assignedTo?.id ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
            className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Não atribuída</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.id === currentUserId ? " (eu)" : ""}
              </option>
            ))}
          </select>
        )}

        {!isAssignedToMe && (
          <button
            onClick={onAssignMe}
            className="w-full py-1.5 text-xs bg-accent hover:bg-accent/80 text-foreground rounded-md transition-colors"
          >
            Assumir conversa
          </button>
        )}

        {conversation.status !== "pending" && conversation.status !== "resolved" && (
          <button
            onClick={onPending}
            className="w-full py-1.5 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 rounded-md transition-colors flex items-center justify-center gap-1"
          >
            <Clock className="w-3 h-3" /> Marcar como pendente
          </button>
        )}

        {conversation.status !== "resolved" && (
          <button
            onClick={onResolve}
            className="w-full py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-600 rounded-md transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-3 h-3" /> Resolver conversa
          </button>
        )}
      </div>

      {/* Sugestão de vinculação de canais (Módulo 2.5) */}
      {canLink &&
        suggestions.map((sug) => {
          const ch = sug.channels[0];
          const chLabel = ch ? CHANNEL_LABELS[ch.channel_type] ?? ch.channel_type : "";
          return (
            <div key={sug.contact_id} className="p-4 border-b border-border bg-primary/5">
              <div className="flex items-start gap-2">
                <Link2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">
                    Este contato pode ser o mesmo que{" "}
                    <span className="font-medium">
                      {chLabel} {ch?.channel_identifier}
                    </span>
                    . Deseja vincular o histórico?
                  </p>
                  <button
                    onClick={() => void handleLink(sug.contact_id)}
                    disabled={linking === sug.contact_id}
                    className="mt-2 px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                  >
                    {linking === sug.contact_id ? "Vinculando..." : "Vincular"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

      {/* Canais vinculados */}
      <div className="p-4 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Canais vinculados
        </p>
        {contact.channels.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum canal</p>
        )}
        <div className="flex flex-col gap-1.5">
          {contact.channels.map((ch) => (
            <div key={ch.id} className="flex items-center gap-2 text-xs">
              <ChannelIcon type={ch.channelType} size={14} />
              <span className="text-muted-foreground">
                {CHANNEL_LABELS[ch.channelType] ?? ch.channelType}
              </span>
              <span className="text-foreground truncate">{ch.channelIdentifier}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Anotações */}
      {contact.notes && (
        <div className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Anotações
          </p>
          <p className="text-xs text-foreground">{contact.notes}</p>
        </div>
      )}

      {/* Histórico de pedidos (Wbuy) */}
      <div className="p-4 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Histórico de pedidos
        </p>
        <OrderHistory contactId={contact.id} compact />
      </div>
    </div>
  );
}
