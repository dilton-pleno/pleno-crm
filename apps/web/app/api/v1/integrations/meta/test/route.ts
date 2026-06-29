import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { testMetaConnection } from "@/lib/meta";

export async function POST(): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;

  try {
    const { pageName } = await testMetaConnection();
    return NextResponse.json({ data: { ok: true, pageName } });
  } catch (err) {
    console.error("[integrations/meta] Teste falhou:", err);
    return NextResponse.json(
      { error: { code: "META_ERROR", message: "Falha na conexão com a Meta" } },
      { status: 502 }
    );
  }
}
