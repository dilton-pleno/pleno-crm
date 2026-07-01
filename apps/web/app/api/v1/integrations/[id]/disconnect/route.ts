import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getIntegration } from "@/lib/integrations";
import { logoutInstance } from "@/lib/evolution";

// Desconecta a sessão da instância Evolution desta integração (troca de número
// sem precisar conectar antes). Cloud não tem sessão a encerrar.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const integration = await getIntegration(id);
  if (!integration || integration.type !== "whatsapp") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integração WhatsApp não encontrada" } }, { status: 404 });
  }
  if (integration.provider === "cloud") {
    return NextResponse.json(
      { error: { code: "NOT_APPLICABLE", message: "API oficial (Cloud) não usa sessão/QR — troque o Phone Number ID e o token." } },
      { status: 422 }
    );
  }
  if (!integration.waInstance) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Instância não definida" } }, { status: 422 });
  }

  try {
    await logoutInstance(integration.waInstance);
    return NextResponse.json({ data: { disconnected: true, instance: integration.waInstance } });
  } catch (err) {
    return NextResponse.json({ error: { code: "EVOLUTION_ERROR", message: err instanceof Error ? err.message : "Falha ao desconectar" } }, { status: 502 });
  }
}
