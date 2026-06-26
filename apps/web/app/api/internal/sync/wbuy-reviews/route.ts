import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { getReviews } from "@/lib/wbuy";
import { syncReviews } from "@/lib/wbuy-review";

// Polling de avaliações pelo N8N (agendado). Busca na Wbuy com as credenciais
// salvas e dispara alerta no sino para as avaliações novas.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const creds = await getWbuyCreds();
  if (!creds) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Credenciais Wbuy não configuradas" } },
      { status: 400 }
    );
  }

  try {
    const reviews = await getReviews(creds, { limit: "0,100" });
    const result = await syncReviews(reviews);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[sync/wbuy-reviews] Erro:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao sincronizar avaliações" } },
      { status: 502 }
    );
  }
}
