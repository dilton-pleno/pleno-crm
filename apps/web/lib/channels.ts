// Metadados de canal compartilhados (rótulo, cor de marca e abreviação).
// Usado pelos badges/ícones de canal no inbox, Kanban e contatos.

export type ChannelType = "whatsapp" | "instagram" | "messenger" | "email" | "site";

export interface ChannelMeta {
  label: string;
  /** Cor de marca (hex) usada no badge. */
  color: string;
  /** Abreviação de fallback quando não há logo. */
  abbr: string;
}

const CHANNELS: Record<string, ChannelMeta> = {
  whatsapp: { label: "WhatsApp", color: "#25D366", abbr: "WA" },
  instagram: { label: "Instagram", color: "#E1306C", abbr: "IG" }, // rosa sólido
  messenger: { label: "Messenger", color: "#0084FF", abbr: "ME" },
  email: { label: "E-mail", color: "#6B7280", abbr: "EM" },
  site: { label: "Site", color: "#0EA5E9", abbr: "SI" },
};

const FALLBACK: ChannelMeta = { label: "Canal", color: "#6B7280", abbr: "??" };

export function getChannelMeta(type: string | null | undefined): ChannelMeta {
  return (type && CHANNELS[type]) || FALLBACK;
}

/** Canais com filtro/seleção na UI (os de atendimento ativo). */
export const FILTERABLE_CHANNELS: ChannelType[] = ["whatsapp", "instagram", "messenger"];
