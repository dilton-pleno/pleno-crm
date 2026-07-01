import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { createIntegration, listIntegrations, serializeIntegration, type IntegrationInput } from "@/lib/integrations";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const type = request.nextUrl.searchParams.get("type");
  const list = await listIntegrations(type === "whatsapp" || type === "meta" ? type : undefined);
  return NextResponse.json({ data: list.map(serializeIntegration) });
}

const createSchema = z.object({
  type: z.enum(["whatsapp", "meta"]),
  name: z.string().min(1).max(80),
  provider: z.enum(["evolution", "cloud"]).optional(),
  active: z.boolean().optional(),
  wa_instance: z.string().max(120).optional(),
  wa_phone_number_id: z.string().max(120).optional(),
  waba_id: z.string().max(120).optional(),
  meta_page_id: z.string().max(120).optional(),
  meta_ig_id: z.string().max(120).optional(),
  access_token: z.string().optional(),
  verify_token: z.string().max(200).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }
  const d = parsed.data;
  const input: IntegrationInput = {
    type: d.type,
    name: d.name,
    provider: d.provider,
    active: d.active,
    waInstance: d.wa_instance,
    waPhoneNumberId: d.wa_phone_number_id,
    metaPageId: d.meta_page_id,
    metaIgId: d.meta_ig_id,
    accessToken: d.access_token,
    wabaId: d.waba_id,
    verifyToken: d.verify_token,
  };

  const created = await createIntegration(input);
  // Recarrega no shape completo (assigned_inbox nulo por ser recém-criada).
  const row = (await listIntegrations(created.type as "whatsapp" | "meta")).find((x) => x.id === created.id);
  if (!row) {
    return NextResponse.json({ error: { code: "INTERNAL", message: "Falha ao criar integração" } }, { status: 500 });
  }
  return NextResponse.json({ data: serializeIntegration(row) }, { status: 201 });
}
