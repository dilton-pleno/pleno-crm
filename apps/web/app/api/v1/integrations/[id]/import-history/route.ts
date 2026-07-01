import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { getIntegration } from "@/lib/integrations";
import { backfillAllChats, getBackfillProgress } from "@/lib/whatsapp-backfill";

// Importa o histórico (90 dias) da instância Evolution desta integração.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN", "GESTOR"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const integration = await getIntegration(id);
  if (!integration || integration.type !== "whatsapp" || integration.provider !== "evolution") {
    return NextResponse.json({ error: { code: "NOT_APPLICABLE", message: "Importação só se aplica a integração WhatsApp Evolution" } }, { status: 422 });
  }
  if (!integration.waInstance) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Instância não definida" } }, { status: 422 });
  }

  const current = await getBackfillProgress();
  if (current?.status === "running") {
    return NextResponse.json({ error: { code: "ALREADY_RUNNING", message: "Já existe uma importação em andamento" } }, { status: 409 });
  }

  const instance = integration.waInstance;
  setImmediate(() => {
    void backfillAllChats(instance, 90);
  });
  return NextResponse.json({ data: { started: true } });
}
