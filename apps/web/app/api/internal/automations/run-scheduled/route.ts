import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { runScheduledAutomations } from "@/lib/automation-engine";

// Dispara automações com gatilho `schedule` (uma vez por dia, a partir do
// horário configurado). Chamado periodicamente pelo cron (N8N).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const result = await runScheduledAutomations();
  return NextResponse.json({ data: result });
}
