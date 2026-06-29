import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ pipeline_ids: z.array(z.string().uuid()) });

// Substitui o conjunto de pipelines vinculados ao time (m2m, compartilhável).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const { id: teamId } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const ids = [...new Set(parsed.data.pipeline_ids)];
  await prisma.$transaction([
    prisma.teamPipeline.deleteMany({ where: { teamId } }),
    prisma.teamPipeline.createMany({ data: ids.map((pipelineId) => ({ teamId, pipelineId })) }),
  ]);

  return NextResponse.json({ data: { team_id: teamId, pipeline_ids: ids } });
}
