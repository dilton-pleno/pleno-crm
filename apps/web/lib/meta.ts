import { createHmac, timingSafeEqual } from "crypto";

const GRAPH_VERSION = "v21.0";

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`;
}

function accessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurada");
  return token;
}

function pageId(): string {
  const id = process.env.META_PAGE_ID;
  if (!id) throw new Error("META_PAGE_ID não configurada");
  return id;
}

/**
 * Valida a assinatura HMAC-SHA256 que a Meta envia no header
 * `x-hub-signature-256` (formato "sha256=HASH"), calculada sobre o corpo
 * cru da requisição usando o META_APP_SECRET.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET não configurada");
  if (!signature) return false;

  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface GraphProfile {
  name?: string;
  username?: string;
  profile_pic?: string;
}

/**
 * Resolve nome/avatar de um usuário (PSID) via Graph API.
 * Retorna null em qualquer falha para não bloquear a ingestão da mensagem.
 */
export async function getUserProfile(psid: string): Promise<GraphProfile | null> {
  try {
    const res = await fetch(
      `${graphUrl(psid)}?fields=name,username,profile_pic&access_token=${accessToken()}`
    );
    if (!res.ok) return null;
    return (await res.json()) as GraphProfile;
  } catch {
    return null;
  }
}

interface SendResponse {
  recipient_id?: string;
  message_id?: string;
  error?: { message: string };
}

async function sendViaGraph(recipientId: string, text: string): Promise<SendResponse> {
  const res = await fetch(`${graphUrl(`${pageId()}/messages`)}?access_token=${accessToken()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta sendMessage falhou [${res.status}]: ${body}`);
  }

  return res.json() as Promise<SendResponse>;
}

/** Envia mensagem de texto no Instagram Direct (recipientId = IG-scoped user id). */
export function sendInstagramDirect(recipientId: string, text: string): Promise<SendResponse> {
  return sendViaGraph(recipientId, text);
}

/** Envia mensagem de texto no Messenger (recipientId = PSID). */
export function sendMessengerMessage(recipientId: string, text: string): Promise<SendResponse> {
  return sendViaGraph(recipientId, text);
}

interface ReplyResponse {
  id?: string;
  error?: { message: string };
}

/** Responde um comentário de post via Graph API. */
export async function replyToComment(commentId: string, message: string): Promise<ReplyResponse> {
  const res = await fetch(`${graphUrl(`${commentId}/replies`)}?access_token=${accessToken()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta replyToComment falhou [${res.status}]: ${body}`);
  }

  return res.json() as Promise<ReplyResponse>;
}

export interface GraphPost {
  id: string;
  media_url?: string;
  caption?: string;
  timestamp?: string;
  comments_count?: number;
}

/** Lista posts recentes da conta IG vinculada (Module 2.4). */
export async function getRecentPosts(igUserId: string, limit = 20): Promise<GraphPost[]> {
  const res = await fetch(
    `${graphUrl(`${igUserId}/media`)}?fields=id,media_url,caption,timestamp,comments_count&limit=${limit}&access_token=${accessToken()}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta getRecentPosts falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data?: GraphPost[] };
  return json.data ?? [];
}

export interface GraphComment {
  id: string;
  username?: string;
  text?: string;
  timestamp?: string;
  from?: { id: string; username?: string };
}

/** Lista comentários de um post (Module 2.4). */
export async function getPostComments(postId: string): Promise<GraphComment[]> {
  const res = await fetch(
    `${graphUrl(`${postId}/comments`)}?fields=id,username,text,timestamp,from&access_token=${accessToken()}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta getPostComments falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data?: GraphComment[] };
  return json.data ?? [];
}
