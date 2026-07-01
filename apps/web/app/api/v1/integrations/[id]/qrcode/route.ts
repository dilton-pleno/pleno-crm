import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getIntegration } from "@/lib/integrations";
import { connectInstance, logoutInstance } from "@/lib/evolution";

// Gera o QR Code da instância Evolution desta integração. force=true desconecta
// a sessão atual antes (para reparear quando já está conectada).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const integration = await getIntegration(id);
  if (!integration || integration.type !== "whatsapp" || integration.provider !== "evolution") {
    return NextResponse.json({ error: { code: "NOT_APPLICABLE", message: "QR Code só se aplica a integração WhatsApp Evolution" } }, { status: 422 });
  }
  const instance = integration.waInstance;
  if (!instance) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Instância não definida nesta integração" } }, { status: 422 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true";
  try {
    if (force) await logoutInstance(instance);
    const result = await connectInstance(instance);
    if (result.kind === "connected") {
      return NextResponse.json(
        { error: { code: "ALREADY_CONNECTED", message: "Instância já conectada. Desconecte antes de gerar novo QR." } },
        { status: 409 }
      );
    }
    return NextResponse.json({ data: { qrcode: result.qrcode } });
  } catch (err) {
    console.error("[integrations/qrcode] erro:", err);
    return NextResponse.json({ error: { code: "EVOLUTION_ERROR", message: "Falha ao gerar QR Code" } }, { status: 502 });
  }
}
