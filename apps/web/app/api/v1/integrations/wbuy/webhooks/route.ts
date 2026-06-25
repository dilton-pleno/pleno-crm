import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { listWebhooks, registerWebhook, WBUY_ORDER_EVENTS } from "@/lib/wbuy";

function callbackUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? "";
  const secret = process.env.INTERNAL_API_SECRET ?? "";
  // O secret vai na query porque o webhook da Wbuy não envia headers custom.
  return `${base.replace(/\/$/, "")}/api/webhooks/wbuy?secret=${encodeURIComponent(secret)}`;
}

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const creds = await getWbuyCreds();
  if (!creds) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Credenciais Wbuy não configuradas" } },
      { status: 400 }
    );
  }

  try {
    const webhooks = await listWebhooks(creds);
    return NextResponse.json({ data: webhooks });
  } catch (err) {
    console.error("[wbuy] Erro ao listar webhooks:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao listar webhooks" } },
      { status: 502 }
    );
  }
}

export async function POST(): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const creds = await getWbuyCreds();
  if (!creds) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Credenciais Wbuy não configuradas" } },
      { status: 400 }
    );
  }

  const url = callbackUrl();
  const results: Array<{ evento: string; ok: boolean }> = [];

  // Registra um webhook por evento de pedido. Falhas individuais (ex.: já
  // existe) não abortam o processo.
  for (const evento of WBUY_ORDER_EVENTS) {
    try {
      await registerWebhook(creds, url, evento);
      results.push({ evento, ok: true });
    } catch (err) {
      console.error(`[wbuy] Falha ao registrar webhook ${evento}:`, err);
      results.push({ evento, ok: false });
    }
  }

  return NextResponse.json({ data: { registered: results } });
}
