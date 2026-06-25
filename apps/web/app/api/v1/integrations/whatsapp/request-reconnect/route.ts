import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";

export async function POST(): Promise<NextResponse> {
  // Qualquer role com acesso a integrações pode solicitar reconexão; na prática
  // é o Atendente, que não tem permissão "full" para gerar o QR diretamente.
  const guard = await requireAccess("integracoes", "read");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  // Evita acumular solicitações duplicadas pendentes do mesmo usuário.
  const existing = await prisma.integrationRequest.findFirst({
    where: {
      type: "whatsapp_reconnect",
      requestedBy: session.user.id,
      status: "pending",
    },
  });
  if (existing) {
    return NextResponse.json({ data: existing }, { status: 200 });
  }

  const request = await prisma.integrationRequest.create({
    data: {
      type: "whatsapp_reconnect",
      requestedBy: session.user.id,
      status: "pending",
    },
  });

  // Notifica gestores/admins online sobre a nova solicitação.
  emitEvent("integration:reconnect_requested", {
    requestId: request.id,
    requesterId: session.user.id,
    requesterName: session.user.name,
  });

  return NextResponse.json({ data: request }, { status: 201 });
}
