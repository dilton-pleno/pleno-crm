import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";
import { getProducts } from "@/lib/wbuy";
import { upsertWbuyProduct } from "@/lib/wbuy-product";

const PAGE_SIZE = 100;
const MAX_PAGES = 200; // até 20k produtos

// Sincroniza todos os produtos ATIVOS da Wbuy (paginado). Admin.
export async function POST(): Promise<NextResponse> {
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

  try {
    let synced = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      const products = await getProducts(creds, { ativo: "1", limit: `${offset},${PAGE_SIZE}` });
      if (products.length === 0) break;
      for (const p of products) {
        if (!p?.id) continue;
        try {
          await upsertWbuyProduct(p, storeId);
          synced++;
        } catch (err) {
          console.error(`[wbuy] Falha ao sincronizar produto ${p.id}:`, err);
        }
      }
      if (products.length < PAGE_SIZE) break;
    }
    return NextResponse.json({ data: { synced } });
  } catch (err) {
    console.error("[wbuy] Erro na sincronização de produtos:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao sincronizar produtos" } },
      { status: 502 }
    );
  }
}
