import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isTeamManager, visiblePipelineIds } from "@/lib/visibility";

const schema = z.object({ pipeline_ids: z.array(z.string().uuid()) });

// Substitui o conjunto de pipelines vinculados ao time (m2m, compartilhável).
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;

  const { id: teamId } = await params;
  if (!(await isTeamManager(guard.session.user, teamId))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Apenas o gestor do time ou um Admin pode alterá-lo" } },
      { status: 403 }
    );
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const ids = [...new Set(parsed.data.pipeline_ids)];

  // Gestor (não-ADMIN) só vincula pipelines já dentro da sua visibilidade.
  const allowed = await visiblePipelineIds(guard.session.user);
  if (allowed && ids.some((id) => !allowed.includes(id))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Você só pode vincular pipelines aos quais já tem acesso" } },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.teamPipeline.deleteMany({ where: { teamId } }),
    prisma.teamPipeline.createMany({ data: ids.map((pipelineId) => ({ teamId, pipelineId })) }),
  ]);

  return NextResponse.json({ data: { team_id: teamId, pipeline_ids: ids } });
}
