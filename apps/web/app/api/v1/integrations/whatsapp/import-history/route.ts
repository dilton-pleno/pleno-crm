import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { backfillAllChats, getBackfillProgress } from "@/lib/whatsapp-backfill";

// Importa o histórico de conversas do WhatsApp (90 dias) em segundo plano.
// Todos os chats individuais; só texto (mídia vira marcador). Admin/Gestor.
export async function POST(): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const instanceName = process.env.EVOLUTION_INSTANCE;
  if (!instanceName) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "EVOLUTION_INSTANCE não configurada" } },
      { status: 500 }
    );
  }

  const current = await getBackfillProgress();
  if (current?.status === "running") {
    return NextResponse.json(
      { error: { code: "ALREADY_RUNNING", message: "Já existe uma importação em andamento" } },
      { status: 409 }
    );
  }

  // Roda em background no servidor persistente (não bloqueia a resposta).
  setImmediate(() => {
    void backfillAllChats(instanceName, 90);
  });

  return NextResponse.json({ data: { started: true } });
}
