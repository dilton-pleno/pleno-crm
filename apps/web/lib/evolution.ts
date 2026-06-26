type MediaType = "image" | "audio" | "document" | "sticker" | "video";

interface EvolutionResponse {
  key?: { id: string };
  error?: string;
}

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL não configurada");
  return url.replace(/\/$/, "");
}

function headers(): HeadersInit {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY não configurada");
  return { "Content-Type": "application/json", apikey: key };
}

export async function sendText(
  instanceName: string,
  to: string,
  text: string
): Promise<EvolutionResponse> {
  const res = await fetch(`${baseUrl()}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: to, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution sendText falhou [${res.status}]: ${body}`);
  }

  return res.json() as Promise<EvolutionResponse>;
}

export interface InstanceStatus {
  status: "connected" | "disconnected";
  number: string | null;
  instanceName: string;
}

// O fetchInstances da Evolution mudou de formato entre versões. Tratamos as
// duas formas conhecidas (v1: { instance: { instanceName, status, owner } } e
// v2: { name, connectionStatus, ownerJid }) de forma defensiva.
interface RawInstanceV2 {
  name?: string;
  instanceName?: string;
  connectionStatus?: string;
  state?: string;
  ownerJid?: string;
  owner?: string;
  number?: string;
}

interface RawInstanceV1 {
  instance?: RawInstanceV2;
}

type RawInstance = RawInstanceV2 & RawInstanceV1;

function normalizeJid(jid: string | undefined): string | null {
  if (!jid) return null;
  // "5511999999999@s.whatsapp.net" -> "5511999999999"
  return jid.split("@")[0] ?? null;
}

/**
 * Busca o status de conexão da instância informada via
 * GET /instance/fetchInstances. Retorna "connected" quando o estado é "open".
 */
export async function fetchInstanceStatus(
  instanceName: string
): Promise<InstanceStatus> {
  const res = await fetch(`${baseUrl()}/instance/fetchInstances`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution fetchInstances falhou [${res.status}]: ${body}`);
  }

  const raw = (await res.json()) as RawInstance[];
  const list = Array.isArray(raw) ? raw : [];

  const match = list.find((item) => {
    const inner = item.instance ?? item;
    return (inner.name ?? inner.instanceName) === instanceName;
  });

  if (!match) {
    return { status: "disconnected", number: null, instanceName };
  }

  const inner = match.instance ?? match;
  const state = inner.connectionStatus ?? inner.state ?? "";
  const number =
    inner.number ?? normalizeJid(inner.ownerJid ?? inner.owner);

  return {
    status: state === "open" ? "connected" : "disconnected",
    number: number ?? null,
    instanceName,
  };
}

interface RawConnectResponse {
  base64?: string;
  code?: string;
  qrcode?: { base64?: string };
}

export type ConnectResult =
  | { kind: "qr"; qrcode: string }
  | { kind: "connected" };

/**
 * Solicita a conexão da instância via GET /instance/connect/{instance}.
 *
 * Quando a instância está desconectada, o Evolution retorna o QR Code em
 * base64. Quando já está conectada, não há QR e o retorno indica o estado
 * "open" — nesse caso devolvemos `kind: "connected"` em vez de lançar erro.
 */
export async function connectInstance(instanceName: string): Promise<ConnectResult> {
  const res = await fetch(`${baseUrl()}/instance/connect/${instanceName}`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution connect falhou [${res.status}]: ${body}`);
  }

  const data = (await res.json()) as RawConnectResponse;
  const base64 = data.base64 ?? data.qrcode?.base64;

  if (base64) {
    return { kind: "qr", qrcode: base64 };
  }

  return { kind: "connected" };
}

/**
 * Desconecta a instância via DELETE /instance/logout/{instance}, encerrando a
 * sessão atual do WhatsApp. Necessário antes de gerar um novo QR Code quando a
 * instância já está conectada. Um 404 é tolerado (instância já desconectada).
 */
export async function logoutInstance(instanceName: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/instance/logout/${instanceName}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Evolution logout falhou [${res.status}]: ${body}`);
  }
}

export interface MediaPayload {
  /** Bytes da mídia já descriptografada */
  data: Uint8Array<ArrayBuffer>;
  mimeType: string | null;
  fileName: string | null;
}

interface RawBase64Response {
  base64?: string;
  mimetype?: string;
  fileName?: string;
}

/**
 * Baixa e descriptografa a mídia de uma mensagem recebida via
 * POST /chat/getBase64FromMediaMessage/{instance}.
 *
 * A `url` que o WhatsApp entrega no webhook é criptografada e inutilizável
 * diretamente; este endpoint do Evolution devolve os bytes reais em base64,
 * que convertemos para Buffer. Retorna null se a mídia não puder ser obtida.
 */
export async function getBase64FromMediaMessage(
  instanceName: string,
  messageKey: { remoteJid: string; fromMe: boolean; id: string }
): Promise<MediaPayload | null> {
  const res = await fetch(
    `${baseUrl()}/chat/getBase64FromMediaMessage/${instanceName}`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ message: { key: messageKey } }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Evolution getBase64FromMediaMessage falhou [${res.status}]: ${body}`
    );
  }

  const data = (await res.json()) as RawBase64Response;
  if (!data.base64) return null;

  // Uint8Array com ArrayBuffer próprio (Prisma Bytes não aceita o Buffer do
  // Node por causa do generic ArrayBufferLike).
  return {
    data: Uint8Array.from(Buffer.from(data.base64, "base64")),
    mimeType: data.mimetype ?? null,
    fileName: data.fileName ?? null,
  };
}

// ============================================================
// Histórico (backfill) — leitura de chats e mensagens armazenadas
// ============================================================

export interface WaMessageKey {
  id: string;
  remoteJid: string;
  fromMe: boolean;
}

// Mesma forma das mensagens do webhook (messages.upsert).
export interface WaMessageRecord {
  key: WaMessageKey;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    audioMessage?: Record<string, unknown>;
    documentMessage?: { fileName?: string; title?: string; caption?: string };
    stickerMessage?: Record<string, unknown>;
    videoMessage?: { caption?: string };
  };
  messageTimestamp?: number | string;
  pushName?: string;
}

export interface WaChat {
  remoteJid: string;
  name: string | null;
}

interface RawChat {
  remoteJid?: string;
  id?: string;
  jid?: string;
  name?: string;
  pushName?: string;
}

/**
 * Lista os chats da instância via POST /chat/findChats. A forma varia entre
 * versões (array direto ou { chats: [...] }); normalizamos para { remoteJid, name }.
 */
export async function findChats(instanceName: string): Promise<WaChat[]> {
  const res = await fetch(`${baseUrl()}/chat/findChats/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution findChats falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as RawChat[] | { chats?: RawChat[] };
  const list = Array.isArray(json) ? json : json.chats ?? [];
  return list
    .map((c) => ({
      remoteJid: c.remoteJid ?? c.id ?? c.jid ?? "",
      name: c.name ?? c.pushName ?? null,
    }))
    .filter((c) => c.remoteJid);
}

interface FindMessagesResult {
  records: WaMessageRecord[];
  pages: number;
  currentPage: number;
}

/**
 * Busca mensagens de um chat via POST /chat/findMessages. Trata a forma v2
 * ({ messages: { records, pages, currentPage } }) e a forma de array direto.
 */
export async function findMessages(
  instanceName: string,
  params: { remoteJid: string; page?: number }
): Promise<FindMessagesResult> {
  const res = await fetch(`${baseUrl()}/chat/findMessages/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      where: { key: { remoteJid: params.remoteJid } },
      page: params.page ?? 1,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution findMessages falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as
    | WaMessageRecord[]
    | { messages?: { records?: WaMessageRecord[]; pages?: number; currentPage?: number } };

  if (Array.isArray(json)) {
    return { records: json, pages: 1, currentPage: 1 };
  }
  const m = json.messages ?? {};
  return {
    records: Array.isArray(m.records) ? m.records : [],
    pages: m.pages ?? 1,
    currentPage: m.currentPage ?? params.page ?? 1,
  };
}

export async function sendMedia(
  instanceName: string,
  to: string,
  url: string,
  caption: string,
  type: MediaType
): Promise<EvolutionResponse> {
  const res = await fetch(`${baseUrl()}/message/sendMedia/${instanceName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ number: to, mediatype: type, media: url, caption }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution sendMedia falhou [${res.status}]: ${body}`);
  }

  return res.json() as Promise<EvolutionResponse>;
}
