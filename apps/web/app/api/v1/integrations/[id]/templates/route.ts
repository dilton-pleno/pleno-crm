import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getIntegration, whatsappCredsFromIntegration } from "@/lib/integrations";
import { listTemplates } from "@/lib/whatsapp-cloud";

// Lista os templates aprovados do WABA desta integração (WhatsApp Cloud).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const integration = await getIntegration(id);
  if (!integration || integration.type !== "whatsapp" || integration.provider !== "cloud") {
    return NextResponse.json({ error: { code: "NOT_APPLICABLE", message: "Templates só existem no WhatsApp API oficial (Cloud)" } }, { status: 422 });
  }
  const c = whatsappCredsFromIntegration(integration);
  if (!c.wabaId || !c.accessToken) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "WABA ID e token não definidos nesta integração" } }, { status: 422 });
  }

  try {
    const templates = await listTemplates(c.wabaId, c.accessToken);
    return NextResponse.json({ data: templates.map((t) => ({ name: t.name, language: t.language, status: t.status, category: t.category })) });
  } catch (err) {
    return NextResponse.json({ error: { code: "META_ERROR", message: err instanceof Error ? err.message : "Falha ao listar templates" } }, { status: 502 });
  }
}
