import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { connectInstance } from "@/lib/evolution";

export async function GET(): Promise<NextResponse> {
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

  try {
    const qrcode = await connectInstance(instanceName);
    return NextResponse.json({ data: { qrcode } });
  } catch (err) {
    console.error("[integrations] Erro ao gerar QR Code:", err);
    return NextResponse.json(
      { error: { code: "EVOLUTION_ERROR", message: "Falha ao gerar QR Code" } },
      { status: 502 }
    );
  }
}
