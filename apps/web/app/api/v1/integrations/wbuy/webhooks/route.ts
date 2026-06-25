import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { listWebhooks, registerWebhook, WBUY_WEBHOOK_TYPES } from "@/lib/wbuy";

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
  const results: Array<{ type: string; ok: boolean }> = [];

  // Registra um webhook por tipo (módulo). Falhas individuais (ex.: já
  // existe) não abortam o processo.
  for (const type of WBUY_WEBHOOK_TYPES) {
    try {
      await registerWebhook(creds, url, type);
      results.push({ type, ok: true });
    } catch (err) {
      console.error(`[wbuy] Falha ao registrar webhook ${type}:`, err);
      results.push({ type, ok: false });
    }
  }

  return NextResponse.json({ data: { registered: results } });
}
