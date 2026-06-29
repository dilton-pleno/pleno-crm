import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  members: z.array(z.object({ user_id: z.string().uuid(), is_manager: z.boolean().optional() })),
});

// Substitui o conjunto de membros do time.
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

  // Deduplica por user_id (último vence).
  const byUser = new Map(parsed.data.members.map((m) => [m.user_id, m.is_manager ?? false]));

  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { teamId } }),
    prisma.teamMember.createMany({
      data: [...byUser].map(([userId, isManager]) => ({ teamId, userId, isManager })),
    }),
  ]);

  return NextResponse.json({ data: { team_id: teamId, count: byUser.size } });
}
