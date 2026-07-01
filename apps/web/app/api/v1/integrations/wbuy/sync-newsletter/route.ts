import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";
import { getNewsletter } from "@/lib/wbuy";
import { syncNewsletter } from "@/lib/wbuy-newsletter";

const PAGE_SIZE = 100;
const MAX_PAGES = 500;

// Sincroniza todos os inscritos da newsletter (paginado). Admin.
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
      const subs = await getNewsletter(creds, { limit: `${offset},${PAGE_SIZE}` });
      if (subs.length === 0) break;
      synced += await syncNewsletter(subs, storeId);
      if (subs.length < PAGE_SIZE) break;
    }
    return NextResponse.json({ data: { synced } });
  } catch (err) {
    console.error("[wbuy] Erro ao sincronizar newsletter:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao sincronizar newsletter" } },
      { status: 502 }
    );
  }
}
