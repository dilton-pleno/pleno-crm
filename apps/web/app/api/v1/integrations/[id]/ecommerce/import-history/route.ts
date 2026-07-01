import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { loadEcommerceStore } from "@/lib/store-integration";
import { getOrders } from "@/lib/wbuy";
import { upsertWbuyOrder } from "@/lib/wbuy-order";

const PAGE = 100;
const MAX_PAGES = 500;

// Importa TODO o histórico de pedidos da LOJA desde a data informada (default
// 2025-03-01). Roda em background (tsx server.ts persistente).
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

  let start = "2025-03-01";
  try {
    const body = (await request.json()) as { start?: string };
    if (body.start && /^\d{4}-\d{2}-\d{2}$/.test(body.start)) start = body.start;
  } catch {
    // sem body: usa default
  }

  setImmediate(async () => {
    let imported = 0;
    try {
      for (let p = 0; p < MAX_PAGES; p++) {
        const orders = await getOrders(creds, { periodo_inicial: start, limit: `${p * PAGE},${PAGE}` });
        if (orders.length === 0) break;
        for (const order of orders) {
          if (!order?.id) continue;
          try { await upsertWbuyOrder(order, id); imported++; } catch (e) { console.error(`[ecom/import ${id}] pedido ${order.id}:`, e); }
        }
        if (orders.length < PAGE) break;
      }
      console.log(`[ecom/import ${id}] concluído: ${imported} pedidos desde ${start}`);
    } catch (err) {
      console.error(`[ecom/import ${id}] erro:`, err);
    }
  });

  return NextResponse.json({ data: { status: "started", start } });
}
