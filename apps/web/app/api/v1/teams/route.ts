import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess, requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { managedTeamIds } from "@/lib/visibility";

// Serializa um time com membros, Canais e pipelines vinculados.
const teamInclude = {
  members: {
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  },
  inboxes: { select: { inboxId: true } },
  pipelines: { select: { pipelineId: true } },
} as const;

type TeamWithRels = {
  id: string;
  name: string;
  members: { userId: string; isManager: boolean; user: { id: string; name: string; email: string; role: string } }[];
  inboxes: { inboxId: string }[];
  pipelines: { pipelineId: string }[];
};

function serialize(t: TeamWithRels) {
  return {
    id: t.id,
    name: t.name,
    members: t.members.map((m) => ({
      user_id: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.user.role,
      is_manager: m.isManager,
    })),
    inbox_ids: t.inboxes.map((i) => i.inboxId),
    pipeline_ids: t.pipelines.map((p) => p.pipelineId),
  };
}

export async function GET(): Promise<NextResponse> {
  // ADMIN vê todos os times; Gestor vê só os que gerencia; demais, nada.
  const guard = await requireAccess("atendimento", "full");
  if (!guard.ok) return guard.response;

  const managed = await managedTeamIds(guard.session.user);
  const teams = await prisma.team.findMany({
    where: managed ? { id: { in: managed } } : {},
    orderBy: { createdAt: "asc" },
    include: teamInclude,
  });

  return NextResponse.json({ data: teams.map((t) => serialize(t as TeamWithRels)) });
}

const createSchema = z.object({ name: z.string().min(1).max(60) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Criar time é exclusivo do ADMIN.
  const guard = await requireRoles(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const team = await prisma.team.create({
    data: { name: parsed.data.name.trim() },
    include: teamInclude,
  });

  return NextResponse.json({ data: serialize(team as TeamWithRels) }, { status: 201 });
}
