import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const METRICS = ["spend", "reach", "clicks", "cpm", "ctr", "roas", "conversions"] as const;
const PLATFORMS = ["meta", "google", "both"] as const;

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    platform: z.enum(PLATFORMS).optional(),
    metric: z.enum(METRICS).optional(),
    operator: z.enum(["gt", "lt", "eq"]).optional(),
    threshold: z.number().optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("campanhas", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const exists = await prisma.alert.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Alerta não encontrado" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { name, platform, metric, operator, threshold, active } = parsed.data;

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(platform !== undefined ? { platform } : {}),
      ...(metric !== undefined ? { metric } : {}),
      ...(operator !== undefined ? { operator } : {}),
      ...(threshold !== undefined ? { threshold: new Prisma.Decimal(threshold) } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      platform: updated.platform,
      metric: updated.metric,
      operator: updated.operator,
      threshold: Number(updated.threshold),
      active: updated.active,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("campanhas", "full");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const exists = await prisma.alert.findUnique({ where: { id } });
  if (!exists) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Alerta não encontrado" } },
      { status: 404 }
    );
  }

  await prisma.alert.delete({ where: { id } });
  return NextResponse.json({ data: { id } });
}
