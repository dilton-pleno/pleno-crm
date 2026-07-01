import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds, setWbuyImportStatus } from "@/lib/wbuy-config";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";
import { getOrders } from "@/lib/wbuy";
import { upsertWbuyOrder } from "@/lib/wbuy-order";

const PAGE_SIZE = 100;
const MAX_PAGES = 500; // teto de segurança (até 50k pedidos)

// Importa TODO o histórico de pedidos desde a data informada (default
// 2025-03-01). Roda em background no servidor persistente (tsx server.ts) e
// grava o progresso em IntegrationConfig.config.lastImport.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const creds = await getWbuyCreds();
  const storeId = await getDefaultStoreIntegrationId();
  if (!creds || !storeId) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Loja/credenciais Wbuy não configuradas" } },
      { status: 400 }
    );
  }

  let start = "2025-03-01";
  try {
    const body = (await request.json()) as { start?: string };
    if (body.start && /^\d{4}-\d{2}-\d{2}$/.test(body.start)) start = body.start;
  } catch {
    // sem body: usa default
  }

  await setWbuyImportStatus({ status: "running", imported: 0, start });

  // Background: pagina todos os pedidos e faz upsert. O 429 é tratado com
  // backoff dentro do cliente Wbuy.
  setImmediate(async () => {
    let imported = 0;
    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const offset = page * PAGE_SIZE;
        const orders = await getOrders(creds, {
          periodo_inicial: start,
          limit: `${offset},${PAGE_SIZE}`,
        });
        if (orders.length === 0) break;
        for (const order of orders) {
          if (!order?.id) continue;
          try {
            await upsertWbuyOrder(order, storeId);
            imported++;
          } catch (err) {
            console.error(`[wbuy] import: falha no pedido ${order.id}:`, err);
          }
        }
        if (orders.length < PAGE_SIZE) break;
      }
      await setWbuyImportStatus({
        status: "done",
        imported,
        start,
        finishedAt: new Date().toISOString(),
      });
      console.log(`[wbuy] Importação concluída: ${imported} pedidos desde ${start}`);
    } catch (err) {
      console.error("[wbuy] Erro na importação de histórico:", err);
      await setWbuyImportStatus({
        status: "error",
        imported,
        start,
        finishedAt: new Date().toISOString(),
      });
    }
  });

  return NextResponse.json({ data: { status: "started", start } });
}
