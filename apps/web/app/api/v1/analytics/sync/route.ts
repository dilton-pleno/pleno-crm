import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { rangeFromDays, pullMetaAds } from "@/lib/ads-pull";

const schema = z.object({
  platform: z.enum(["meta"]),
  days: z.number().int().positive().max(365).optional(),
});

// Coleta sob demanda ("Sincronizar agora"): puxa as métricas reais da plataforma
// para o banco. Escrita → exige acesso total a Integrações.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { platform, days } = parsed.data;
  const range = rangeFromDays(days ?? 30);

  try {
    let synced = 0;
    if (platform === "meta") synced = await pullMetaAds(range);

    return NextResponse.json({
      data: { platform, synced, period: { start: range.start, end: range.end } },
    });
  } catch (err) {
    console.error(`[analytics/sync] ${platform} falhou:`, err);
    const message = err instanceof Error ? err.message : "Falha ao sincronizar";
    return NextResponse.json(
      { error: { code: "SYNC_ERROR", message } },
      { status: 502 }
    );
  }
}
