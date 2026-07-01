import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getIntegrationFull,
  updateIntegration,
  serializeIntegration,
  assignedInboxOf,
  type IntegrationInput,
} from "@/lib/integrations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const row = await getIntegrationFull(id);
  if (!row) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integração não encontrada" } }, { status: 404 });
  }
  return NextResponse.json({ data: serializeIntegration(row) });
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  provider: z.enum(["evolution", "cloud"]).optional(),
  active: z.boolean().optional(),
  wa_instance: z.string().max(120).optional().nullable(),
  wa_phone_number_id: z.string().max(120).optional().nullable(),
  waba_id: z.string().max(120).optional(),
  meta_page_id: z.string().max(120).optional().nullable(),
  meta_ig_id: z.string().max(120).optional().nullable(),
  access_token: z.string().optional(),
  verify_token: z.string().max(200).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }
  const d = parsed.data;
  const input: IntegrationInput = {
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

  const updated = await updateIntegration(id, input);
  if (!updated) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integração não encontrada" } }, { status: 404 });
  }
  const row = await getIntegrationFull(id);
  return NextResponse.json({ data: row ? serializeIntegration(row) : null });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const integration = await prisma.integration.findUnique({ where: { id }, select: { id: true } });
  if (!integration) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Integração não encontrada" } }, { status: 404 });
  }

  // Não excluir se atribuída a um Canal (evita quebrar o atendimento).
  const assigned = await assignedInboxOf(id);
  if (assigned) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: `Integração em uso no Canal "${assigned.name}". Desvincule-a primeiro.` } },
      { status: 409 }
    );
  }

  await prisma.integration.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
