import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const METRICS = ["spend", "reach", "clicks", "cpm", "ctr", "roas", "conversions"] as const;
const PLATFORMS = ["meta", "google", "both"] as const;

const createSchema = z.object({
  name: z.string().min(1),
  platform: z.enum(PLATFORMS),
  metric: z.enum(METRICS),
  operator: z.enum(["gt", "lt", "eq"]),
  threshold: z.number(),
  active: z.boolean().optional().default(true),
});

export async function GET(): Promise<NextResponse> {
  // Admin e Gestor visualizam (campanhas = read para Gestor).
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: alerts.map((a) => ({
      id: a.id,
      name: a.name,
      platform: a.platform,
      metric: a.metric,
      operator: a.operator,
      threshold: Number(a.threshold),
      active: a.active,
      notified_at: a.notifiedAt?.toISOString() ?? null,
      created_at: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apenas Admin cria/edita alertas (campanhas = full só para Admin).
  const guard = await requireAccess("campanhas", "full");
  if (!guard.ok) return guard.response;
  const session = guard.session;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { name, platform, metric, operator, threshold, active } = parsed.data;

  const alert = await prisma.alert.create({
    data: {
      name,
      platform,
      metric,
      operator,
      threshold: new Prisma.Decimal(threshold),
      active,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: alert.id,
        name: alert.name,
        platform: alert.platform,
        metric: alert.metric,
        operator: alert.operator,
        threshold: Number(alert.threshold),
        active: alert.active,
      },
    },
    { status: 201 }
  );
}
