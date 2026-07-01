import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { loadEcommerceStore } from "@/lib/store-integration";
import { testConnection } from "@/lib/wbuy";

// Testa a conexão da loja (integração e-commerce) com a API da Wbuy.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const store = await loadEcommerceStore(id);
  if (!store) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Loja/credenciais não configuradas" } }, { status: 422 });
  }

  try {
    const ok = await testConnection(store.creds);
    return NextResponse.json({ data: { connected: ok, platform: store.integration.platform } });
  } catch (err) {
    return NextResponse.json({ error: { code: "WBUY_ERROR", message: err instanceof Error ? err.message : "Falha no teste" } }, { status: 502 });
  }
}
