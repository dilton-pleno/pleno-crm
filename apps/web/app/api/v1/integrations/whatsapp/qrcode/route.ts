import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { connectInstance, logoutInstance } from "@/lib/evolution";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Admin e Gestor podem gerar o QR Code diretamente, sem solicitação.
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;

  const instanceName = process.env.EVOLUTION_INSTANCE;
  if (!instanceName) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIG_ERROR",
          message: "EVOLUTION_INSTANCE não configurada",
        },
      },
      { status: 500 }
    );
  }

  // force=true desconecta a sessão atual antes de gerar um novo QR Code,
  // necessário para reparear quando a instância já está conectada.
  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    if (force) {
      await logoutInstance(instanceName);
    }

    const result = await connectInstance(instanceName);

    if (result.kind === "connected") {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_CONNECTED",
            message:
              "A instância já está conectada. Desconecte antes de gerar um novo QR Code.",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: { qrcode: result.qrcode } });
  } catch (err) {
    console.error("[integrations] Erro ao gerar QR Code:", err);
    return NextResponse.json(
      { error: { code: "EVOLUTION_ERROR", message: "Falha ao gerar QR Code" } },
      { status: 502 }
    );
  }
}
