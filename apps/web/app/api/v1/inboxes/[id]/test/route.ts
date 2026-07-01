import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { fetchInstanceStatus } from "@/lib/evolution";
import { getMessagingConfig } from "@/lib/inbox-config";
import { getWhatsappChannel } from "@/lib/whatsapp-channel-config";
import { getPhoneNumberInfo } from "@/lib/whatsapp-cloud";

const schema = z.object({ target: z.enum(["whatsapp", "meta"]) });

const GRAPH_VERSION = "v21.0";

export async function POST(
  request: NextRequest,
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

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  try {
    if (parsed.data.target === "whatsapp") {
      const ch = await getWhatsappChannel(id);

      if (ch.provider === "cloud") {
        // API oficial: consulta o número na Cloud API.
        if (!ch.phoneNumberId || !ch.accessToken) {
          return NextResponse.json(
            { error: { code: "NOT_CONFIGURED", message: "Phone Number ID e token do Cloud não definidos (Canal nem global)" } },
            { status: 422 }
          );
        }
        const info = await getPhoneNumberInfo({ phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken });
        return NextResponse.json({
          data: {
            target: "whatsapp",
            provider: "cloud",
            connected: true,
            verifiedName: info.verifiedName,
            number: info.displayPhoneNumber,
            qualityRating: info.qualityRating,
          },
        });
      }

      // API não oficial (Evolution): status da instância.
      const instance = ch.instance;
      if (!instance) {
        return NextResponse.json(
          { error: { code: "NOT_CONFIGURED", message: "Instância do WhatsApp não definida neste Canal" } },
          { status: 422 }
        );
      }
      const status = await fetchInstanceStatus(instance);
      return NextResponse.json({
        data: {
          target: "whatsapp",
          provider: "evolution",
          connected: status.status === "connected",
          instance,
          number: status.number,
        },
      });
    }

    // Meta: GET /{page}?fields=name com o token resolvido do Canal (fallback global).
    const cfg = await getMessagingConfig(id);
    if (!cfg.accessToken || !cfg.pageId) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "Page ID e token Meta não definidos (Canal nem global)" } },
        { status: 422 }
      );
    }
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.pageId}?fields=name&access_token=${cfg.accessToken}`
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: { code: "META_ERROR", message: `Falha Meta [${res.status}]: ${body}` } },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { name?: string };
    return NextResponse.json({
      data: { target: "meta", connected: true, pageName: json.name ?? "(sem nome)" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "TEST_ERROR", message: err instanceof Error ? err.message : "Falha no teste" } },
      { status: 502 }
    );
  }
}
