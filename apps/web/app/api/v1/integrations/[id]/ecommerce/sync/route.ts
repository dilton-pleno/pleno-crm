import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { loadEcommerceStore } from "@/lib/store-integration";
import { getOrders, getProducts, getReviews, getNewsletter, getCustomers } from "@/lib/wbuy";
import { upsertWbuyOrder } from "@/lib/wbuy-order";
import { upsertWbuyProduct } from "@/lib/wbuy-product";
import { syncReviews } from "@/lib/wbuy-review";
import { syncNewsletter } from "@/lib/wbuy-newsletter";
import { syncCustomers } from "@/lib/wbuy-customer";

const PAGE = 100;

type Kind = "orders" | "products" | "reviews" | "newsletter" | "customers";

// Sincroniza um TIPO de dado da loja (integração e-commerce), escopado à loja.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const store = await loadEcommerceStore(id);
  if (!store) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Loja/credenciais não configuradas" } }, { status: 422 });
  }
  const { creds } = store;
  const kind = ((await request.json().catch(() => ({}))) as { kind?: Kind }).kind;

  try {
    if (kind === "orders") {
      const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const orders = await getOrders(creds, { periodo_inicial: since, limit: "0,100" });
      let synced = 0;
      for (const o of orders) {
        if (!o?.id) continue;
        try { await upsertWbuyOrder(o, id); synced++; } catch (e) { console.error("[ecom/sync] pedido", o.id, e); }
      }
      return NextResponse.json({ data: { kind, synced } });
    }
    if (kind === "products") {
      let synced = 0;
      for (let p = 0; p < 200; p++) {
        const items = await getProducts(creds, { ativo: "1", limit: `${p * PAGE},${PAGE}` });
        if (items.length === 0) break;
        for (const it of items) { if (!it?.id) continue; try { await upsertWbuyProduct(it, id); synced++; } catch (e) { console.error("[ecom/sync] produto", it.id, e); } }
        if (items.length < PAGE) break;
      }
      return NextResponse.json({ data: { kind, synced } });
    }
    if (kind === "reviews") {
      const reviews = await getReviews(creds, { limit: "0,100" });
      const result = await syncReviews(reviews, id);
      return NextResponse.json({ data: { kind, ...result } });
    }
    if (kind === "newsletter") {
      let synced = 0;
      for (let p = 0; p < 500; p++) {
        const subs = await getNewsletter(creds, { limit: `${p * PAGE},${PAGE}` });
        if (subs.length === 0) break;
        synced += await syncNewsletter(subs, id);
        if (subs.length < PAGE) break;
      }
      return NextResponse.json({ data: { kind, synced } });
    }
    if (kind === "customers") {
      let enriched = 0;
      for (let p = 0; p < 1000; p++) {
        const customers = await getCustomers(creds, { limit: `${p * PAGE},${PAGE}` });
        if (customers.length === 0) break;
        enriched += (await syncCustomers(customers)).enriched;
        if (customers.length < PAGE) break;
      }
      return NextResponse.json({ data: { kind, enriched } });
    }
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "kind inválido" } }, { status: 422 });
  } catch (err) {
    console.error("[ecom/sync] erro:", err);
    return NextResponse.json({ error: { code: "WBUY_ERROR", message: err instanceof Error ? err.message : "Falha na sincronização" } }, { status: 502 });
  }
}
