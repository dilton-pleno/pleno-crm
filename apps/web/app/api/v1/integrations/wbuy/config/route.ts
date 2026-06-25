import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyStatus, saveWbuyCreds } from "@/lib/wbuy-config";

const putSchema = z.object({
  api_user: z.string().min(1),
  api_secret: z.string().min(1),
});

export async function GET(): Promise<NextResponse> {
  // Gestão de credenciais é restrita ao Admin.
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const status = await getWbuyStatus();
  return NextResponse.json({ data: status });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  try {
    await saveWbuyCreds(parsed.data.api_user, parsed.data.api_secret);
  } catch (err) {
    console.error("[wbuy] Erro ao salvar credenciais:", err);
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "Falha ao salvar (ENCRYPTION_KEY configurada?)" } },
      { status: 500 }
    );
  }

  const status = await getWbuyStatus();
  return NextResponse.json({ data: status });
}
