"use client";

import { useState, useEffect, useCallback } from "react";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageTimeline } from "@/components/inbox/message-timeline";
import { MessageInput } from "@/components/inbox/message-input";
import { ContactPanel } from "@/components/inbox/contact-panel";
import { useWebSocket } from "@/hooks/use-websocket";
import { getAccessLevel } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";

interface ConversationItem {
  id: string;
  contact: { id: string; name: string; avatar_url: string | null };
  last_message: { content: string | null; direction: "in" | "out"; sent_at: string } | null;
  unread_count: number;
  status: "open" | "pending" | "resolved";
  channel_type: string;
  assigned_to: { id: string; name: string } | null;
}

interface MessageItem {
  id: string;
  direction: "in" | "out";
  content: string | null;
  media_url: string | null;
  media_type: "image" | "audio" | "document" | "sticker" | "video" | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  sender: { id: string; name: string; type: "contact" | "agent" };
}

interface ContactDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  notes: string | null;
  channels: Array<{ id: string; channelType: string; channelIdentifier: string }>;
}

interface Agent {
  id: string;
  name: string;
}

interface Props {
  currentUserId: string;
  currentUserRole: Role;
  agents: Agent[];
}

export function InboxClient({ currentUserId, currentUserRole, agents }: Props) {
  const canLink = getAccessLevel(currentUserRole, "contatos") === "full";
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/conversations?limit=50");
      if (res.ok) {
        const json = (await res.json()) as { data: ConversationItem[] };
        setConversations(json.data);
      }
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/v1/conversations/${convId}/messages`);
      if (res.ok) {
        const json = (await res.json()) as { data: MessageItem[] };
        setMessages(json.data);
      }
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const fetchContact = useCallback(async (convId: string, convs: ConversationItem[]) => {
    const conv = convs.find((c) => c.id === convId);
    if (!conv) return;
    try {
      const res = await fetch(`/api/v1/contacts/${conv.contact.id}`);
      if (res.ok) {
        const json = (await res.json()) as { data: ContactDetail };
        setContact(json.data);
      }
    } catch {
      setContact({
        id: conv.contact.id,
        name: conv.contact.name,
        phone: null,
        email: null,
        avatarUrl: conv.contact.avatar_url,
        notes: null,
        channels: [],
      });
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setMessages([]);
      setContact(null);
      void fetchMessages(id);
      void fetchContact(id, conversations);
    },
    [fetchMessages, fetchContact, conversations]
  );

  // WebSocket realtime
  useWebSocket({
    "conversation:new": () => {
      void fetchConversations();
    },
    "message:new": (payload) => {
      const convId = payload["conversationId"] as string;
      void fetchConversations();
      if (convId === selectedId) {
        void fetchMessages(convId);
      }
    },
    "conversation:assigned": () => {
      void fetchConversations();
    },
    "conversation:status_changed": () => {
      void fetchConversations();
    },
  });

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  const updateStatus = useCallback(
    async (status: "open" | "pending" | "resolved") => {
      if (!selectedId) return;
      await fetch(`/api/v1/conversations/${selectedId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      void fetchConversations();
    },
    [selectedId, fetchConversations]
  );

  const assignTo = useCallback(
    async (userId: string | null) => {
      if (!selectedId) return;
      await fetch(`/api/v1/conversations/${selectedId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      void fetchConversations();
    },
    [selectedId, fetchConversations]
  );

  const assignMe = useCallback(() => void assignTo(currentUserId), [assignTo, currentUserId]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Coluna 1: Lista de conversas */}
      {loadingConvs ? (
        <div className="flex items-center justify-center border-r border-border bg-card" style={{ width: 280 }}>
          <p className="text-xs text-muted-foreground">Carregando...</p>
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelect}
          currentUserId={currentUserId}
        />
      )}

      {/* Coluna 2: Linha do tempo */}
      <div className="flex flex-col flex-1 min-w-0 bg-background">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa para começar
          </div>
        ) : (
          <>
            {/* Header da conversa */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                {selectedConv?.contact.name.charAt(0).toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selectedConv?.contact.name ?? "Carregando..."}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {selectedConv?.channel_type} ·{" "}
                  {selectedConv?.status === "open"
                    ? "Aberta"
                    : selectedConv?.status === "pending"
                    ? "Pendente"
                    : "Resolvida"}
                </p>
              </div>
            </div>

            {loadingMsgs ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Carregando mensagens...
              </div>
            ) : (
              <MessageTimeline messages={messages} />
            )}

            <MessageInput
              conversationId={selectedId}
              onMessageSent={() => void fetchMessages(selectedId)}
            />
          </>
        )}
      </div>

      {/* Coluna 3: Painel de contato */}
      <ContactPanel
        contact={contact}
        conversation={
          selectedConv
            ? {
                id: selectedConv.id,
                status: selectedConv.status,
                assignedTo: selectedConv.assigned_to,
              }
            : null
        }
        onResolve={() => void updateStatus("resolved")}
        onPending={() => void updateStatus("pending")}
        onAssignMe={assignMe}
        onAssign={(userId) => void assignTo(userId)}
        onLinked={() => {
          void fetchConversations();
          if (selectedId) void fetchContact(selectedId, conversations);
        }}
        canLink={canLink}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        agents={agents}
      />
    </div>
  );
}
