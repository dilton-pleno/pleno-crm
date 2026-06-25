// Cliente da Wbuy REST API (https://sistema.sistemawbuy.com.br/api/v1).
// Auth: Authorization: Bearer base64(usuario_api:senha_api).
// As credenciais são passadas como argumento (vêm de IntegrationConfig,
// cifradas). Inclui backoff em 429 (rate limit 100 req / 60s).

export interface WbuyCreds {
  user: string;
  secret: string;
}

export interface WbuyWebhook {
  id: string;
  type: string;
  url: string;
}

// Tipos de webhook da Wbuy (campo "type" no POST). A API aceita: customer,
// order, order_status, product, stock, stock_price, abandoned_cart.
// Registramos os relevantes para o CRM (pedidos, clientes e carrinho abandonado).
export const WBUY_WEBHOOK_TYPES = [
  "order",
  "order_status",
  "customer",
  "abandoned_cart",
] as const;

function baseUrl(): string {
  return (process.env.WBUY_API_URL || "https://sistema.sistemawbuy.com.br/api/v1").replace(/\/$/, "");
}

function authHeader(creds: WbuyCreds): string {
  return "Bearer " + Buffer.from(`${creds.user}:${creds.secret}`).toString("base64");
}

interface WbuyEnvelope<T> {
  code?: string;
  message?: string;
  responseCode?: string;
  data?: T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Requisição base à Wbuy. Trata o envelope { data } e faz retry com backoff
 * exponencial em HTTP 429 (rate limit). Lança erro nos demais status >= 400.
 */
async function request<T>(
  creds: WbuyCreds,
  path: string,
  init: RequestInit = {},
  attempt = 0
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
      "User-Agent": "PlenoCRM/1.0 (agencia@pleno.dev.br)",
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
    await sleep(retryAfter * 1000);
    return request<T>(creds, path, init, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Wbuy ${path} falhou [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as WbuyEnvelope<T>;
  return (json.data ?? ([] as unknown)) as T;
}

/**
 * Testa as credenciais com uma chamada leve. Retorna true se autenticou.
 */
export async function testConnection(creds: WbuyCreds): Promise<boolean> {
  await request(creds, "/customer/?limit=0,1");
  return true;
}

// Shape do pedido conforme a resposta real da Wbuy (GET /order/{id}).
export interface WbuyOrder {
  id: string;
  identificacao?: string;
  data?: string; // "AAAA-MM-DD HH:MM:SS"
  status?: { id?: string; nome?: string };
  valor_total?: { subtotal?: string; desconto?: string; total?: string };
  frete?: { rastreio?: string; nome?: string; valor?: string; prazo?: string };
  cliente?: {
    nome?: string;
    email?: string;
    telefone1?: string;
    telefone2?: string;
  };
  produtos?: Array<{
    produto?: string;
    qtd?: string;
    valor?: string;
    sku?: string;
    cod?: string;
  }>;
}

export async function getOrders(
  creds: WbuyCreds,
  params: { periodo_inicial?: string; periodo_final?: string; status?: string; statusDesde?: string; limit?: string } = {}
): Promise<WbuyOrder[]> {
  const qs = new URLSearchParams();
  if (params.periodo_inicial) qs.set("periodo_inicial", params.periodo_inicial);
  if (params.periodo_final) qs.set("periodo_final", params.periodo_final);
  if (params.status) qs.set("status", params.status);
  if (params.statusDesde) qs.set("statusDesde", params.statusDesde);
  qs.set("order", "data,desc");
  qs.set("limit", params.limit ?? "0,100");
  return request<WbuyOrder[]>(creds, `/order/?${qs.toString()}`);
}

export async function getOrderById(creds: WbuyCreds, id: string): Promise<WbuyOrder | null> {
  const data = await request<WbuyOrder[] | WbuyOrder>(creds, `/order/${id}`);
  return Array.isArray(data) ? data[0] ?? null : data;
}

interface RawWebhook {
  id?: string | number;
  url?: string;
  // A Wbuy pode devolver `type` como string ou como objeto { id, name }.
  type?: string | { id?: string | number; name?: string } | null;
}

function normalizeType(t: RawWebhook["type"]): string {
  if (typeof t === "string") return t;
  if (t && typeof t === "object") return String(t.name ?? t.id ?? "");
  return "";
}

export async function listWebhooks(creds: WbuyCreds): Promise<WbuyWebhook[]> {
  const raw = await request<RawWebhook[]>(creds, "/webhook");
  return (Array.isArray(raw) ? raw : []).map((w) => ({
    id: String(w.id ?? ""),
    url: typeof w.url === "string" ? w.url : "",
    type: normalizeType(w.type),
  }));
}

export async function registerWebhook(
  creds: WbuyCreds,
  url: string,
  type: string
): Promise<void> {
  await request(creds, "/webhook/", {
    method: "POST",
    body: JSON.stringify({ type, url }),
  });
}

export async function deleteWebhook(creds: WbuyCreds, id: string): Promise<void> {
  await request(creds, `/webhook/${id}`, { method: "DELETE" });
}
