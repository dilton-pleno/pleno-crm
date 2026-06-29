import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// Execuções recentes (todas as automações) — aba "Execuções" / observabilidade.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("automacoes");
  if (!guard.ok) return guard.response;

  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10)));

  const runs = await prisma.automationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { automation: { select: { name: true } } },
  });

  return NextResponse.json({
    data: runs.map((r) => ({
      id: r.id,
      automation_name: r.automation.name,
      trigger: r.trigger,
      status: r.status,
      error: r.error,
      created_at: r.createdAt.toISOString(),
    })),
  });
}
