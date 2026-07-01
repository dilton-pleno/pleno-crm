import { NextRequest, NextResponse } from "next/server";
import { processWbuyEvent, type WbuyWebhookPayload } from "@/lib/wbuy-webhook";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";
import { safeEqual } from "@/lib/crypto";

// Receiver GLOBAL de webhooks da Wbuy → atribui à LOJA PRINCIPAL (default).
// Mantido para não quebrar a loja atual (zero downtime). Lojas novas usam a rota
// por-loja /api/webhooks/wbuy/[integrationId]. O secret vai na query porque a
// Wbuy não envia headers custom. Responde 200 rápido (a Wbuy desabilita webhooks
// que não retornam 200/201) e processa de forma assíncrona.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected || !secret || !safeEqual(secret, expected)) {
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
      const storeId = await getDefaultStoreIntegrationId();
      if (!storeId) {
        console.error("[webhook/wbuy] Nenhuma loja e-commerce configurada; evento ignorado");
        return;
      }
      await processWbuyEvent(payload, storeId);
    } catch (err) {
      console.error("[webhook/wbuy] Erro ao processar evento:", err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
