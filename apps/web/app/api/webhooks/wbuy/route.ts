import { NextRequest, NextResponse } from "next/server";

// Receiver de webhooks da Wbuy (eventos de pedido/pagamento). O secret vai na
// query porque a Wbuy não envia headers custom. Fase 1: valida e responde 200;
// o processamento dos pedidos entra na Fase 2.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Secret inválido" } },
      { status: 401 }
    );
  }

  if (process.env.WEBHOOK_DEBUG === "true") {
    const payload = await request.text();
    console.log("[webhook/wbuy] Payload recebido:", payload);
  }

  // TODO (Fase 2): processar evento de pedido (upsert Order + status).
  return NextResponse.json({ ok: true }, { status: 200 });
}
