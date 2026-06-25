import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { deleteWebhook } from "@/lib/wbuy";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const creds = await getWbuyCreds();
  if (!creds) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Credenciais Wbuy não configuradas" } },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    await deleteWebhook(creds, id);
    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error("[wbuy] Erro ao remover webhook:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao remover webhook" } },
      { status: 502 }
    );
  }
}
