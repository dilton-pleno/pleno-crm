import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";
import { getReviews } from "@/lib/wbuy";
import { syncReviews } from "@/lib/wbuy-review";

// Sincroniza avaliações sob demanda (Admin). Dispara alerta para as novas.
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
    const reviews = await getReviews(creds, { limit: "0,100" });
    const result = await syncReviews(reviews, storeId);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[wbuy] Erro ao sincronizar avaliações:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao sincronizar avaliações" } },
      { status: 502 }
    );
  }
}
