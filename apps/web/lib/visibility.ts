import { prisma } from "@/lib/prisma";
import type { Role } from "@pleno-crm/types";

// Visibilidade por Time (Fase 4). Define quais Canais (Inbox) um usuário enxerga.

export interface VisibilityUser {
  id: string;
  role: Role | string;
}

/**
 * Ids dos Canais visíveis para o usuário.
 * - ADMIN → `null` (sem restrição, vê tudo).
 * - Sem nenhum time → `null` (legado: vê tudo até ser adicionado a um time).
 * - Com time(s) → união dos Canais dos seus times (pode ser `[]` se os times
 *   ainda não têm Canal vinculado — nesse caso o usuário não vê conversas).
 */
export async function visibleInboxIds(user: VisibilityUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;

  const memberships = await prisma.teamMember.findMany({
    where: { userId: user.id },
    select: { team: { select: { inboxes: { select: { inboxId: true } } } } },
  });
  if (memberships.length === 0) return null;

  const ids = new Set<string>();
  for (const m of memberships) {
    for (const ti of m.team.inboxes) ids.add(ti.inboxId);
  }
  return [...ids];
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
