import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { testConnection } from "@/lib/wbuy";

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

  try {
    await testConnection(creds);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error("[wbuy] Teste de conexão falhou:", err);
    return NextResponse.json(
      { error: { code: "CONNECTION_FAILED", message: "Não foi possível autenticar na Wbuy" } },
      { status: 502 }
    );
  }
}
