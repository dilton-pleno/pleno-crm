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
