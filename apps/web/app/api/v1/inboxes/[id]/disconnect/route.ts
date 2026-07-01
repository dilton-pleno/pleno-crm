import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logoutInstance } from "@/lib/evolution";
import { getWhatsappChannel } from "@/lib/whatsapp-channel-config";

// Desconecta o WhatsApp do Canal. Para provider "evolution", faz logout da
// instância (encerra a sessão) — permite trocar de número gerando um novo QR
// depois, sem precisar "conectar" antes só para conseguir desconectar.
// Para "cloud" não há sessão a encerrar (é baseado em token).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const inbox = await prisma.inbox.findUnique({ where: { id } });
  if (!inbox) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Canal não encontrado" } },
      { status: 404 }
    );
  }

  const ch = await getWhatsappChannel(id);

  if (ch.provider === "cloud") {
    return NextResponse.json(
      {
        error: {
          code: "NOT_APPLICABLE",
          message: "A API oficial (Cloud) não usa sessão/QR — para trocar o número, edite o Phone Number ID e o token do Canal.",
        },
      },
      { status: 422 }
    );
  }

  if (!ch.instance) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Instância do WhatsApp não definida neste Canal" } },
      { status: 422 }
    );
  }

  try {
    await logoutInstance(ch.instance);
    return NextResponse.json({ data: { disconnected: true, instance: ch.instance } });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "EVOLUTION_ERROR", message: err instanceof Error ? err.message : "Falha ao desconectar" } },
      { status: 502 }
    );
  }
}
