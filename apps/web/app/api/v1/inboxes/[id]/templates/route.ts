import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWhatsappChannel } from "@/lib/whatsapp-channel-config";
import { listTemplates } from "@/lib/whatsapp-cloud";

// Lista os templates aprovados do WABA do Canal (WhatsApp API oficial), para
// seleção nos disparos/automações. Só faz sentido em Canais provider "cloud".
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const ch = await getWhatsappChannel(id);

  if (ch.provider !== "cloud") {
    return NextResponse.json(
      { error: { code: "NOT_APPLICABLE", message: "Templates só existem no WhatsApp API oficial (Cloud)" } },
      { status: 422 }
    );
  }
  if (!ch.wabaId || !ch.accessToken) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "WABA ID e token do Cloud não definidos neste Canal" } },
      { status: 422 }
    );
  }

  try {
    const templates = await listTemplates(ch.wabaId, ch.accessToken);
    return NextResponse.json({
      data: templates.map((t) => ({
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "META_ERROR", message: err instanceof Error ? err.message : "Falha ao listar templates" } },
      { status: 502 }
    );
  }
}
