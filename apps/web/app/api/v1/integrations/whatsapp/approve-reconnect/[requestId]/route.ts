import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { connectInstance } from "@/lib/evolution";
import { emitEvent } from "@/lib/websocket";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
): Promise<NextResponse> {
  // Apenas Admin e Gestor (acesso "full") podem aprovar solicitações.
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  const { requestId } = await params;

  const reconnectRequest = await prisma.integrationRequest.findUnique({
    where: { id: requestId },
  });
  if (!reconnectRequest) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Solicitação não encontrada" } },
      { status: 404 }
    );
  }
  if (reconnectRequest.status !== "pending") {
    return NextResponse.json(
      {
        error: {
          code: "ALREADY_HANDLED",
          message: "Solicitação já foi tratada",
        },
      },
      { status: 409 }
    );
  }

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

  let qrcode: string;
  try {
    qrcode = await connectInstance(instanceName);
  } catch (err) {
    console.error("[integrations] Erro ao gerar QR Code:", err);
    return NextResponse.json(
      {
        error: {
          code: "EVOLUTION_ERROR",
          message: "Falha ao gerar QR Code",
        },
      },
      { status: 502 }
    );
  }

  await prisma.integrationRequest.update({
    where: { id: requestId },
    data: { status: "approved", approvedBy: session.user.id },
  });

  // Entrega o QR Code ao Atendente que fez a solicitação.
  emitEvent("integration:qr_code", {
    requestId,
    qrcode,
    targetUserId: reconnectRequest.requestedBy,
  });

  return NextResponse.json({ data: { requestId, qrcode } });
}
