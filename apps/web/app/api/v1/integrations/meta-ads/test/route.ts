import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { testMetaAdsConnection } from "@/lib/meta-ads";

export async function POST(): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;

  try {
    const { accountName } = await testMetaAdsConnection();
    return NextResponse.json({ data: { ok: true, accountName } });
  } catch (err) {
    console.error("[integrations/meta-ads] Teste falhou:", err);
    return NextResponse.json(
      { error: { code: "META_ADS_ERROR", message: "Falha na conexão de anúncios" } },
      { status: 502 }
    );
  }
}
