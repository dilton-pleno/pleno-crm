import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import type { WbuyOrder } from "@/lib/wbuy";
import { upsertWbuyOrder } from "@/lib/wbuy-order";

interface Body {
  orders?: WbuyOrder[];
}

// Recebe pedidos já buscados na Wbuy (pelo N8N) e faz upsert vinculando ao
// contato. Idempotente por external_id.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Body;
  const orders = Array.isArray(body.orders) ? body.orders : [];

  let synced = 0;
  for (const order of orders) {
    if (!order?.id) continue;
    try {
      await upsertWbuyOrder(order);
      synced++;
    } catch (err) {
      console.error(`[sync/wbuy-orders] Falha no pedido ${order.id}:`, err);
    }
  }

  return NextResponse.json({ data: { received: orders.length, synced } });
}
