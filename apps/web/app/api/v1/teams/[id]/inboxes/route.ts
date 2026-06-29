import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isTeamManager, visibleInboxIds } from "@/lib/visibility";

const schema = z.object({ inbox_ids: z.array(z.string().uuid()) });

// Substitui o conjunto de Canais vinculados ao time.
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

  const ids = [...new Set(parsed.data.inbox_ids)];

  // Gestor (não-ADMIN) só vincula Canais já dentro da sua visibilidade — pode
  // compartilhar entre os seus times, mas não conceder acesso a Canais novos.
  const allowed = await visibleInboxIds(guard.session.user);
  if (allowed && ids.some((id) => !allowed.includes(id))) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Você só pode vincular Canais aos quais já tem acesso" } },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.teamInbox.deleteMany({ where: { teamId } }),
    prisma.teamInbox.createMany({ data: ids.map((inboxId) => ({ teamId, inboxId })) }),
  ]);

  return NextResponse.json({ data: { team_id: teamId, inbox_ids: ids } });
}
