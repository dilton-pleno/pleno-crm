// Cliente da WhatsApp Cloud API (API OFICIAL da Meta, Graph API v21). Espelha o
// papel do lib/evolution.ts, mas para o provider "cloud" por Canal. Credenciais
// (phone_number_id + token) são resolvidas por lib/whatsapp-channel-config.ts.
import type { MediaType } from "@prisma/client";

const GRAPH_VERSION = "v21.0";

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`;
}

export interface CloudCreds {
  phoneNumberId: string;
  accessToken: string;
}

interface CloudSendResponse {
  messages?: { id: string }[];
  error?: { message?: string };
}

/** POST genérico no endpoint /{phone_number_id}/messages. Lança em erro HTTP. */
async function postToMessages(
  creds: CloudCreds,
  body: Record<string, unknown>
): Promise<CloudSendResponse> {
  const res = await fetch(graphUrl(`${creds.phoneNumberId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });

  const json = (await res.json().catch(() => ({}))) as CloudSendResponse;
  if (!res.ok) {
    throw new Error(
      `WhatsApp Cloud falhou [${res.status}]: ${json.error?.message ?? JSON.stringify(json)}`
    );
  }
  return json;
}

/** Envia mensagem de texto. Retorna o wamid (id) da mensagem, quando disponível. */
export async function sendText(
  creds: CloudCreds,
  to: string,
  text: string
): Promise<{ id: string | null }> {
  const json = await postToMessages(creds, {
    to,
    type: "text",
    text: { body: text, preview_url: true },
  });
  return { id: json.messages?.[0]?.id ?? null };
}

// A Cloud API aceita os mesmos tipos que o nosso enum MediaType.
type CloudMediaType = MediaType;

/**
 * Envia mídia a partir de uma URL PÚBLICA (a Meta baixa o arquivo). Usado quando
 * a origem já é um link acessível (ex.: automações). Upload por bytes do
 * compositor vem na fase de anexos (uploadMedia + sendMediaById).
 */
export async function sendMediaByLink(
  creds: CloudCreds,
  to: string,
  params: { link: string; type: CloudMediaType; caption?: string | null; fileName?: string | null }
): Promise<{ id: string | null }> {
  const media: Record<string, unknown> = { link: params.link };
  // caption só é aceito em image/video/document; audio/sticker não têm legenda.
  if (params.caption && ["image", "video", "document"].includes(params.type)) {
    media.caption = params.caption;
  }
  if (params.fileName && params.type === "document") {
    media.filename = params.fileName;
  }
  const json = await postToMessages(creds, { to, type: params.type, [params.type]: media });
  return { id: json.messages?.[0]?.id ?? null };
}

/**
 * Sobe um arquivo (bytes) para a Cloud API via POST /{phone_number_id}/media
 * (multipart). Retorna o media id, que depois é enviado por sendMediaById.
 * A Cloud não aceita a nossa URL de mídia protegida, então subimos os bytes.
 */
export async function uploadMedia(
  creds: CloudCreds,
  params: { bytes: Uint8Array; mimeType: string; fileName: string }
): Promise<string> {
  // Cópia para um ArrayBuffer próprio (evita incompatibilidade de tipo do Blob
  // com Uint8Array<ArrayBufferLike> vindo do Buffer do Node).
  const ab = new ArrayBuffer(params.bytes.byteLength);
  new Uint8Array(ab).set(params.bytes);

  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("type", params.mimeType);
  fd.append("file", new Blob([ab], { type: params.mimeType }), params.fileName);

  // Não definir Content-Type manualmente: o fetch cuida do boundary do multipart.
  const res = await fetch(graphUrl(`${creds.phoneNumberId}/media`), {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.accessToken}` },
    body: fd,
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(`WhatsApp Cloud uploadMedia falhou [${res.status}]: ${json.error?.message ?? JSON.stringify(json)}`);
  }
  return json.id;
}

/** Envia mídia já hospedada na Meta (media id obtido por uploadMedia). */
export async function sendMediaById(
  creds: CloudCreds,
  to: string,
  params: { mediaId: string; type: CloudMediaType; caption?: string | null; fileName?: string | null }
): Promise<{ id: string | null }> {
  const media: Record<string, unknown> = { id: params.mediaId };
  if (params.caption && ["image", "video", "document"].includes(params.type)) {
    media.caption = params.caption;
  }
  if (params.fileName && params.type === "document") {
    media.filename = params.fileName;
  }
  const json = await postToMessages(creds, { to, type: params.type, [params.type]: media });
  return { id: json.messages?.[0]?.id ?? null };
}

export interface CloudMediaPayload {
  /** Bytes da mídia já baixada */
  data: Uint8Array<ArrayBuffer>;
  mimeType: string | null;
  fileName: string | null;
}

/**
 * Baixa a mídia recebida a partir do media id (fluxo em 2 passos da Cloud API):
 * 1) GET /{media-id} devolve uma URL temporária (lookaside) + mime_type;
 * 2) GET nessa URL, autenticado com o token, devolve os bytes.
 * Retorna null em qualquer falha, para não travar a ingestão da mensagem.
 */
export async function downloadMediaById(
  creds: CloudCreds,
  mediaId: string,
  fileName?: string | null
): Promise<CloudMediaPayload | null> {
  const metaRes = await fetch(graphUrl(mediaId), {
    headers: { Authorization: `Bearer ${creds.accessToken}` },
  });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return null;

  const bin = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${creds.accessToken}` },
  });
  if (!bin.ok) return null;
  const buf = Buffer.from(await bin.arrayBuffer());

  return {
    data: Uint8Array.from(buf),
    mimeType: meta.mime_type ?? bin.headers.get("content-type"),
    fileName: fileName ?? null,
  };
}

/** Marca uma mensagem recebida como lida (opcional; melhora o "visto" do cliente). */
export async function markAsRead(creds: CloudCreds, messageId: string): Promise<void> {
  await postToMessages(creds, { status: "read", message_id: messageId });
}

// ---- Templates (mensagens ativas fora da janela de 24h) ----

export interface CloudTemplate {
  name: string;
  status: string; // "APPROVED" | "PENDING" | "REJECTED" | ...
  language: string;
  category: string;
}

/** Lista os templates do WABA (GET /{waba_id}/message_templates). */
export async function listTemplates(
  wabaId: string,
  accessToken: string
): Promise<CloudTemplate[]> {
  const res = await fetch(
    graphUrl(`${wabaId}/message_templates?fields=name,status,language,category&limit=200`),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp Cloud listTemplates falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data?: CloudTemplate[] };
  return json.data ?? [];
}

export interface TemplateComponent {
  type: string; // "body" | "header" | "button"
  parameters?: { type: string; text?: string }[];
}

/**
 * Envia uma mensagem de template. `language` é o code (ex.: "pt_BR"), e
 * `components` carrega os parâmetros das variáveis (ex.: corpo {{1}}, {{2}}).
 */
export async function sendTemplate(
  creds: CloudCreds,
  to: string,
  params: { name: string; language: string; components?: TemplateComponent[] }
): Promise<{ id: string | null }> {
  const json = await postToMessages(creds, {
    to,
    type: "template",
    template: {
      name: params.name,
      language: { code: params.language },
      components: params.components ?? [],
    },
  });
  return { id: json.messages?.[0]?.id ?? null };
}

export interface CloudPhoneInfo {
  verifiedName: string | null;
  displayPhoneNumber: string | null;
  qualityRating: string | null;
}

/** Info do número (verified_name/display_phone_number/quality_rating) — usado no "Testar conexão". */
export async function getPhoneNumberInfo(creds: CloudCreds): Promise<CloudPhoneInfo> {
  const res = await fetch(
    graphUrl(`${creds.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`),
    { headers: { Authorization: `Bearer ${creds.accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp Cloud getPhoneNumberInfo falhou [${res.status}]: ${body}`);
  }
  const j = (await res.json()) as {
    verified_name?: string;
    display_phone_number?: string;
    quality_rating?: string;
  };
  return {
    verifiedName: j.verified_name ?? null,
    displayPhoneNumber: j.display_phone_number ?? null,
    qualityRating: j.quality_rating ?? null,
  };
}
