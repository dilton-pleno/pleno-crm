import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { fetchInstanceStatus } from "@/lib/evolution";
import { getBackfillProgress } from "@/lib/whatsapp-backfill";

export async function GET(): Promise<NextResponse> {
  // Status pode ser consultado por qualquer role com acesso a integrações.
  const guard = await requireAccess("integracoes", "read");
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
    const status = await fetchInstanceStatus(instanceName);
    const historyImport = await getBackfillProgress();
    return NextResponse.json({ data: { ...status, historyImport } });
  } catch (err) {
    console.error("[integrations] Erro ao consultar status do WhatsApp:", err);
    return NextResponse.json(
      {
        error: {
          code: "EVOLUTION_ERROR",
          message: "Falha ao consultar status da instância",
        },
      },
      { status: 502 }
    );
  }
}
