import { NextRequest, NextResponse } from "next/server";
import { processWbuyEvent, type WbuyWebhookPayload } from "@/lib/wbuy-webhook";
import { resolveStoreByWebhookSecret } from "@/lib/store-integration";

// Receiver de webhooks da Wbuy POR LOJA: a URL carrega o id da integração e o
// secret próprio da loja (?secret=). Atribui os dados àquela loja. Usado por
// lojas adicionais (a loja principal segue no webhook global).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
): Promise<NextResponse> {
  const { integrationId } = await params;
  const secret = request.nextUrl.searchParams.get("secret");

  const storeId = await resolveStoreByWebhookSecret(integrationId, secret);
  if (!storeId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Secret de loja inválido" } },
      { status: 401 }
    );
  }

  const payload = (await request.json()) as WbuyWebhookPayload;

  if (process.env.WEBHOOK_DEBUG === "true") {
    console.log(`[webhook/wbuy/${integrationId}] Payload:`, JSON.stringify(payload));
  }

  setImmediate(async () => {
    try {
      await processWbuyEvent(payload, storeId);
    } catch (err) {
      console.error(`[webhook/wbuy/${integrationId}] Erro ao processar evento:`, err);
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
