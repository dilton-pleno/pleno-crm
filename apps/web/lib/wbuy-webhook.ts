import type { WbuyOrder, WbuyAbandonedCart, WbuyCustomerRaw } from "@/lib/wbuy";
import { upsertWbuyOrder, updateWbuyOrderStatus, upsertAbandonedCart } from "@/lib/wbuy-order";
import { enrichContactFromCustomer } from "@/lib/wbuy-customer";
import { runAbandonedCartRecovery } from "@/lib/cart-recovery";
import { runOrderStatusDispatch, runPurchaseCountDispatch } from "@/lib/order-dispatch";

export interface WbuyWebhookPayload {
  lid?: string;
  type?: string;
  method?: string;
  data?: unknown;
}

interface OrderStatusData {
  pedido_id?: string;
  status_nome?: string;
}

/**
 * Processa um evento de webhook da Wbuy atribuindo os dados à LOJA informada
 * (storeIntegrationId). Reutilizado pelo webhook global (loja principal) e pelo
 * webhook por-loja. Tolerante: o chamador roda em setImmediate e captura erros.
 */
export async function processWbuyEvent(
  payload: WbuyWebhookPayload,
  storeIntegrationId: string
): Promise<void> {
  if (payload.type === "order" && payload.data) {
    const order = payload.data as WbuyOrder;
    await upsertWbuyOrder(order, storeIntegrationId);
    // Disparo por Nº de compras (só age com automação purchase_count ativa + Canal oficial).
    await runPurchaseCountDispatch({ orderExternalId: String(order.id), storeIntegrationId });
  } else if (payload.type === "order_status" && payload.data) {
    const d = payload.data as OrderStatusData;
    if (d.pedido_id) {
      const status = d.status_nome ?? "—";
      await updateWbuyOrderStatus(d.pedido_id, status, storeIntegrationId);
      await runOrderStatusDispatch({ orderExternalId: String(d.pedido_id), status, storeIntegrationId });
    }
  } else if (payload.type === "abandoned_cart" && payload.data) {
    const cart = payload.data as WbuyAbandonedCart;
    await upsertAbandonedCart(cart, storeIntegrationId);
    await runAbandonedCartRecovery({ phone: cart.cliente?.telefone, name: cart.cliente?.nome });
  } else if (payload.type === "customer" && payload.data) {
    // Enriquece um contato existente (não cria contato sem interação). Global ao contato.
    await enrichContactFromCustomer(payload.data as WbuyCustomerRaw);
  }
  // product: ignorado (produtos têm sync próprio).
}
