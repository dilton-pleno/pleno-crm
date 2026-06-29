import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { resumeDueRuns } from "@/lib/automation-engine";

// Retoma automações em espera (ação `wait`) cujo tempo já venceu.
// Chamado periodicamente pelo cron (N8N).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const result = await resumeDueRuns();
  return NextResponse.json({ data: result });
}
