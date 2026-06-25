import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { getOrders } from "@/lib/wbuy";
import { upsertWbuyOrder } from "@/lib/wbuy-order";

// Sincronização sob demanda (Admin): puxa os pedidos recentes da Wbuy e faz
// upsert. Útil para backfill inicial e para validar a integração na hora.
export async function POST(): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const creds = await getWbuyCreds();
  if (!creds) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Credenciais Wbuy não configuradas" } },
      { status: 400 }
    );
  }

  try {
    // Últimos 90 dias, até 100 pedidos mais recentes.
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const orders = await getOrders(creds, { periodo_inicial: since, limit: "0,100" });

    let synced = 0;
    for (const order of orders) {
      if (!order?.id) continue;
      try {
        await upsertWbuyOrder(order);
        synced++;
      } catch (err) {
        console.error(`[wbuy] Falha ao sincronizar pedido ${order.id}:`, err);
      }
    }

    return NextResponse.json({ data: { fetched: orders.length, synced } });
  } catch (err) {
    console.error("[wbuy] Erro na sincronização de pedidos:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao sincronizar pedidos" } },
      { status: 502 }
    );
  }
}
