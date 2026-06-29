import { createHmac, timingSafeEqual } from "crypto";
import { getMetaConfig } from "@/lib/meta-config";
import { getMessagingConfig } from "@/lib/inbox-config";

const GRAPH_VERSION = "v21.0";

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path.replace(/^\//, "")}`;
}

// Resolve token/page do Canal (inboxId) quando informado; senão, config global.
async function requireToken(inboxId?: string | null): Promise<string> {
  const { accessToken } = await getMessagingConfig(inboxId);
  if (!accessToken) throw new Error("Access token da Meta não configurado");
  return accessToken;
}

async function requirePageId(inboxId?: string | null): Promise<string> {
  const { pageId } = await getMessagingConfig(inboxId);
  if (!pageId) throw new Error("Page ID da Meta não configurado");
  return pageId;
}

/**
 * Valida a assinatura HMAC-SHA256 que a Meta envia no header
 * `x-hub-signature-256` (formato "sha256=HASH"), calculada sobre o corpo
 * cru da requisição usando o app secret.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const { appSecret } = await getMetaConfig();
  if (!appSecret) throw new Error("App secret da Meta não configurado");
  if (!signature) return false;

  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
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
export async function getUserProfile(psid: string, inboxId?: string | null): Promise<GraphProfile | null> {
  try {
    const token = await requireToken(inboxId);
    const res = await fetch(
      `${graphUrl(psid)}?fields=name,username,profile_pic&access_token=${token}`
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

async function sendViaGraph(recipientId: string, text: string, inboxId?: string | null): Promise<SendResponse> {
  const [token, page] = [await requireToken(inboxId), await requirePageId(inboxId)];
  const res = await fetch(`${graphUrl(`${page}/messages`)}?access_token=${token}`, {
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
export function sendInstagramDirect(recipientId: string, text: string, inboxId?: string | null): Promise<SendResponse> {
  return sendViaGraph(recipientId, text, inboxId);
}

/** Envia mensagem de texto no Messenger (recipientId = PSID). */
export function sendMessengerMessage(recipientId: string, text: string, inboxId?: string | null): Promise<SendResponse> {
  return sendViaGraph(recipientId, text, inboxId);
}

/**
 * Responde um comentário de forma privada, abrindo um Direct com o autor
 * (Module 2.4 — "converter comentário em Direct"). A Graph API roteia a
 * mensagem para a DM quando o recipient é `comment_id`.
 */
export async function sendPrivateReply(commentId: string, text: string): Promise<SendResponse> {
  const [token, page] = [await requireToken(), await requirePageId()];
  const res = await fetch(`${graphUrl(`${page}/messages`)}?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta sendPrivateReply falhou [${res.status}]: ${body}`);
  }

  return res.json() as Promise<SendResponse>;
}

interface ReplyResponse {
  id?: string;
  error?: { message: string };
}

/** Responde um comentário de post via Graph API. */
export async function replyToComment(commentId: string, message: string): Promise<ReplyResponse> {
  const token = await requireToken();
  const res = await fetch(`${graphUrl(`${commentId}/replies`)}?access_token=${token}`, {
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
  const token = await requireToken();
  const res = await fetch(
    `${graphUrl(`${igUserId}/media`)}?fields=id,media_url,caption,timestamp,comments_count&limit=${limit}&access_token=${token}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta getRecentPosts falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data?: GraphPost[] };
  return json.data ?? [];
}

/** Busca caption/mídia de um post específico (usado ao registrar comentários). */
export async function getPostById(postId: string): Promise<GraphPost | null> {
  try {
    const token = await requireToken();
    const res = await fetch(
      `${graphUrl(postId)}?fields=id,media_url,caption,timestamp,comments_count&access_token=${token}`
    );
    if (!res.ok) return null;
    return (await res.json()) as GraphPost;
  } catch {
    return null;
  }
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
  const token = await requireToken();
  const res = await fetch(
    `${graphUrl(`${postId}/comments`)}?fields=id,username,text,timestamp,from&access_token=${token}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta getPostComments falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { data?: GraphComment[] };
  return json.data ?? [];
}

/** Testa a conexão Meta: busca o nome da página. Lança erro se falhar. */
export async function testMetaConnection(): Promise<{ pageName: string }> {
  const [token, page] = [await requireToken(), await requirePageId()];
  const res = await fetch(`${graphUrl(page)}?fields=name&access_token=${token}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta teste falhou [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { name?: string };
  return { pageName: json.name ?? "(sem nome)" };
}
