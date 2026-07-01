import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getIntegration, whatsappCredsFromIntegration, metaCredsFromIntegration } from "@/lib/integrations";
import { fetchInstanceStatus } from "@/lib/evolution";
import { getPhoneNumberInfo } from "@/lib/whatsapp-cloud";

const GRAPH_VERSION = "v21.0";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const integration = await getIntegration(id);
  if (!integration) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integração não encontrada" } }, { status: 404 });
  }

  try {
    if (integration.type === "whatsapp") {
      const c = whatsappCredsFromIntegration(integration);
      if (c.provider === "cloud") {
        if (!c.phoneNumberId || !c.accessToken) {
          return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Phone Number ID e token do Cloud não definidos" } }, { status: 422 });
        }
        const info = await getPhoneNumberInfo({ phoneNumberId: c.phoneNumberId, accessToken: c.accessToken });
        return NextResponse.json({ data: { provider: "cloud", connected: true, verifiedName: info.verifiedName, number: info.displayPhoneNumber, qualityRating: info.qualityRating } });
      }
      if (!c.instance) {
        return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Instância do WhatsApp não definida" } }, { status: 422 });
      }
      const status = await fetchInstanceStatus(c.instance);
      return NextResponse.json({ data: { provider: "evolution", connected: status.status === "connected", instance: c.instance, number: status.number } });
    }

    // Meta: GET /{page}?fields=name
    const c = metaCredsFromIntegration(integration);
    if (!c.accessToken || !c.pageId) {
      return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Page ID e token Meta não definidos" } }, { status: 422 });
    }
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${c.pageId}?fields=name&access_token=${c.accessToken}`);
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: { code: "META_ERROR", message: `Falha Meta [${res.status}]: ${body}` } }, { status: 502 });
    }
    const json = (await res.json()) as { name?: string };
    return NextResponse.json({ data: { provider: "meta", connected: true, pageName: json.name ?? "(sem nome)" } });
  } catch (err) {
    return NextResponse.json({ error: { code: "TEST_ERROR", message: err instanceof Error ? err.message : "Falha no teste" } }, { status: 502 });
  }
}
