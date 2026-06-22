export type Role = "ADMIN" | "GESTOR" | "ATENDENTE";

export type ChannelType = "whatsapp" | "instagram" | "messenger" | "email" | "site";

export type ConversationStatus = "open" | "pending" | "resolved";

export type MessageDirection = "in" | "out";

export type MediaType = "image" | "audio" | "document" | "sticker" | "video";

export type Platform = "meta" | "google";

export type AlertOperator = "gt" | "lt" | "eq";

export type TriggerType =
  | "new_message"
  | "keyword"
  | "new_contact"
  | "conversation_opened"
  | "schedule";

export type ActionType =
  | "send_message"
  | "assign_agent"
  | "add_tag"
  | "move_kanban"
  | "webhook"
  | "wait";

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type Module =
  | "atendimento"
  | "contatos"
  | "kanban"
  | "campanhas"
  | "alertas"
  | "automacoes"
  | "configuracoes";
