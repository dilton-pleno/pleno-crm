import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { loadEcommerceStore, storeWebhookUrl } from "@/lib/store-integration";
import { listWebhooks, registerWebhook, WBUY_WEBHOOK_TYPES } from "@/lib/wbuy";

// GET: URL de webhook própria da loja + webhooks já registrados na Wbuy.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const store = await loadEcommerceStore(id);
  if (!store) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Loja/credenciais não configuradas" } }, { status: 422 });
  }

  try {
    const webhooks = await listWebhooks(store.creds);
    return NextResponse.json({ data: { url: storeWebhookUrl(store.integration), webhooks } });
  } catch (err) {
    return NextResponse.json({ error: { code: "WBUY_ERROR", message: err instanceof Error ? err.message : "Falha ao listar webhooks" } }, { status: 502 });
  }
}

// POST: registra na Wbuy os webhooks apontando para a URL própria da loja.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const store = await loadEcommerceStore(id);
  if (!store) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Loja/credenciais não configuradas" } }, { status: 422 });
  }
  const url = storeWebhookUrl(store.integration);
  if (!url) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Secret de webhook da loja ausente" } }, { status: 422 });
  }

  const results: Array<{ type: string; ok: boolean }> = [];
  for (const type of WBUY_WEBHOOK_TYPES) {
    try {
      await registerWebhook(store.creds, url, type);
      results.push({ type, ok: true });
    } catch (err) {
      console.error(`[ecom/webhooks] Falha ao registrar ${type}:`, err);
      results.push({ type, ok: false });
    }
  }
  return NextResponse.json({ data: { registered: results } });
}
