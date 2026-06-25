import { NextRequest, NextResponse } from "next/server";
import type { WbuyOrder, WbuyAbandonedCart } from "@/lib/wbuy";
import { upsertWbuyOrder, updateWbuyOrderStatus, upsertAbandonedCart } from "@/lib/wbuy-order";

interface WbuyWebhookPayload {
  lid?: string;
  type?: string;
  method?: string;
  data?: unknown;
}

interface OrderStatusData {
  pedido_id?: string;
  status_nome?: string;
}

// Receiver de webhooks da Wbuy. O secret vai na query porque a Wbuy não envia
// headers custom. Responde 200 rápido (a Wbuy desabilita webhooks que não
// retornam 200/201) e processa de forma assíncrona.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Secret inválido" } },
      { status: 401 }
    );
  }

  const payload = (await request.json()) as WbuyWebhookPayload;

  if (process.env.WEBHOOK_DEBUG === "true") {
    console.log("[webhook/wbuy] Payload recebido:", JSON.stringify(payload));
  }

  setImmediate(async () => {
    try {
      if (payload.type === "order" && payload.data) {
        await upsertWbuyOrder(payload.data as WbuyOrder);
      } else if (payload.type === "order_status" && payload.data) {
        const d = payload.data as OrderStatusData;
        if (d.pedido_id) {
          await updateWbuyOrderStatus(d.pedido_id, d.status_nome ?? "—");
        }
      } else if (payload.type === "abandoned_cart" && payload.data) {
        await upsertAbandonedCart(payload.data as WbuyAbandonedCart);
      }
      // customer / product: ignorados nesta fase.
    } catch (err) {
      console.error("[webhook/wbuy] Erro ao processar evento:", err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
