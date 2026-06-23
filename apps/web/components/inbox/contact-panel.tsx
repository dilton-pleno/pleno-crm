"use client";

import Link from "next/link";
import { Phone, Mail, Hash, CheckCircle, Clock, ExternalLink } from "lucide-react";

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

interface Props {
  contact: Contact | null;
  conversation: ConversationMeta | null;
  onResolve: () => void;
  onPending: () => void;
  onAssignMe: () => void;
  currentUserId: string;
}

export function ContactPanel({
  contact,
  conversation,
  onResolve,
  onPending,
  onAssignMe,
  currentUserId,
}: Props) {
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
              <Hash className="w-3 h-3 text-muted-foreground" />
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

      {/* Placeholder Wbuy */}
      <div className="p-4 mt-auto border-t border-border">
        <p className="text-xs text-muted-foreground italic">
          Histórico de pedidos disponível após integração Wbuy (Módulo 5)
        </p>
      </div>
    </div>
  );
}
