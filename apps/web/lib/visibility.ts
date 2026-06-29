import { prisma } from "@/lib/prisma";
import type { Role } from "@pleno-crm/types";

// Visibilidade por Time (Fase 4). Define quais Canais (Inbox) um usuário enxerga.

export interface VisibilityUser {
  id: string;
  role: Role | string;
}

/**
 * Ids dos Canais visíveis para o usuário (ISOLAMENTO ESTRITO).
 * - ADMIN → `null` (sem restrição, vê tudo).
 * - Sem nenhum time → `[]` (não vê nada).
 * - Com time(s) → união dos Canais dos seus times (pode ser `[]`).
 */
export async function visibleInboxIds(user: VisibilityUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;

  const memberships = await prisma.teamMember.findMany({
    where: { userId: user.id },
    select: { team: { select: { inboxes: { select: { inboxId: true } } } } },
  });

  const ids = new Set<string>();
  for (const m of memberships) {
    for (const ti of m.team.inboxes) ids.add(ti.inboxId);
  }
  return [...ids];
}

/**
 * Ids dos Pipelines visíveis para o usuário (mesma lógica dos Canais).
 * - ADMIN → `null` (todos). Senão, união dos pipelines dos seus times (`[]` se nenhum).
 */
export async function visiblePipelineIds(user: VisibilityUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;

  const memberships = await prisma.teamMember.findMany({
    where: { userId: user.id },
    select: { team: { select: { pipelines: { select: { pipelineId: true } } } } },
  });

  const ids = new Set<string>();
  for (const m of memberships) {
    for (const tp of m.team.pipelines) ids.add(tp.pipelineId);
  }
  return [...ids];
}

/**
 * O usuário (por id) enxerga este Canal? Usado para validar destinatário de
 * atribuição. Busca o papel no banco (ADMIN sempre vê).
 */
export async function userSeesInbox(userId: string, inboxId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  const member = await prisma.teamMember.findFirst({
    where: { userId, team: { inboxes: { some: { inboxId } } } },
    select: { teamId: true },
  });
  return Boolean(member);
}

/** Cláusula Prisma para campos com `inboxId` direto (Conversation, PostComment). */
export function inboxFilter(ids: string[] | null): { inboxId?: { in: string[] } } {
  return ids ? { inboxId: { in: ids } } : {};
}

/** Pode o usuário ver um Canal específico? */
export async function canSeeInbox(user: VisibilityUser, inboxId: string): Promise<boolean> {
  const ids = await visibleInboxIds(user);
  return ids === null || ids.includes(inboxId);
}

/**
 * Ids dos times que o usuário GERENCIA (isManager). ADMIN → `null` (todos).
 * Gestor → seus times de gestão. Atendente → `[]`.
 */
export async function managedTeamIds(user: VisibilityUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;
  const rows = await prisma.teamMember.findMany({
    where: { userId: user.id, isManager: true },
    select: { teamId: true },
  });
  return rows.map((r) => r.teamId);
}

/** O usuário gerencia este time? (ADMIN sempre pode). */
export async function isTeamManager(user: VisibilityUser, teamId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const m = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
    select: { isManager: true },
  });
  return Boolean(m?.isManager);
}
