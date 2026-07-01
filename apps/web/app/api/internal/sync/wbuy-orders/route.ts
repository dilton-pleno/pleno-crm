import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import type { WbuyOrder } from "@/lib/wbuy";
import { upsertWbuyOrder } from "@/lib/wbuy-order";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";

interface Body {
  orders?: WbuyOrder[];
}

// Recebe pedidos já buscados na Wbuy (pelo N8N) e faz upsert vinculando ao
// contato. Idempotente por (loja, external_id).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const storeId = await getDefaultStoreIntegrationId();
  if (!storeId) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Nenhuma loja e-commerce configurada" } }, { status: 400 });
  }

  const body = (await request.json()) as Body;
  const orders = Array.isArray(body.orders) ? body.orders : [];

  let synced = 0;
  for (const order of orders) {
    if (!order?.id) continue;
    try {
      await upsertWbuyOrder(order, storeId);
      synced++;
    } catch (err) {
      console.error(`[sync/wbuy-orders] Falha no pedido ${order.id}:`, err);
    }
  }

  return NextResponse.json({ data: { received: orders.length, synced } });
}
