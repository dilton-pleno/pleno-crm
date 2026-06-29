import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { managedTeamIds, visibleInboxIds, visiblePipelineIds } from "@/lib/visibility";

const schema = z
  .object({
    inbox_id: z.string().uuid().optional(),
    pipeline_id: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.inbox_id) !== Boolean(d.pipeline_id), {
    message: "Informe inbox_id OU pipeline_id",
  });

/**
 * Compartilha (ADICIONA) um Canal ou pipeline da visibilidade do solicitante
 * com OUTRO time. ADMIN ou Gestor podem; o recurso precisa estar na visibilidade
 * de quem compartilha (não concede acesso a recursos que não possui). Só adiciona
 * — remover continua sendo do gestor/Admin do time de destino.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;
  const user = guard.session.user;

  // Apenas ADMIN ou quem gerencia algum time pode compartilhar.
  const managed = await managedTeamIds(user);
  if (managed !== null && managed.length === 0) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Apenas gestores podem compartilhar" } },
      { status: 403 }
    );
  }

  const { id: targetTeamId } = await params;
  const target = await prisma.team.findUnique({ where: { id: targetTeamId }, select: { id: true } });
  if (!target) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Time de destino não encontrado" } },
      { status: 404 }
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  if (parsed.data.inbox_id) {
    const inboxId = parsed.data.inbox_id;
    const allowed = await visibleInboxIds(user);
    if (allowed && !allowed.includes(inboxId)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Você só pode compartilhar Canais aos quais tem acesso" } },
        { status: 403 }
      );
    }
    await prisma.teamInbox.upsert({
      where: { teamId_inboxId: { teamId: targetTeamId, inboxId } },
      update: {},
      create: { teamId: targetTeamId, inboxId },
    });
    return NextResponse.json({ data: { team_id: targetTeamId, inbox_id: inboxId } });
  }

  const pipelineId = parsed.data.pipeline_id!;
  const allowedPipes = await visiblePipelineIds(user);
  if (allowedPipes && !allowedPipes.includes(pipelineId)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Você só pode compartilhar pipelines aos quais tem acesso" } },
      { status: 403 }
    );
  }
  await prisma.teamPipeline.upsert({
    where: { teamId_pipelineId: { teamId: targetTeamId, pipelineId } },
    update: {},
    create: { teamId: targetTeamId, pipelineId },
  });
  return NextResponse.json({ data: { team_id: targetTeamId, pipeline_id: pipelineId } });
}
