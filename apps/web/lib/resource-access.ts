import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { visibleInboxIds } from "@/lib/visibility";

// Controle de acesso a nível de objeto (object-level authorization): garante
// que o usuário só acesse conversas/contatos dos Canais que ele enxerga. Usa
// 404 (em vez de 403) quando o recurso existe mas está fora da visibilidade,
// para não vazar a existência de recursos de outras equipes.

type Result<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

function notFound(entity: string): NextResponse {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: `${entity} não encontrada` } },
    { status: 404 }
  );
}

/** Verifica que o usuário pode acessar a conversa (pelo Canal). */
export async function requireConversationAccess(
  session: Session,
  conversationId: string
): Promise<Result<{ id: string; inboxId: string | null; contactId: string }>> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, inboxId: true, contactId: true },
  });
  if (!conv) return { ok: false, response: notFound("Conversa") };
  if (session.user.role === "ADMIN") return { ok: true, value: conv };

  const ids = await visibleInboxIds(session.user);
  if (ids === null) return { ok: true, value: conv };
  if (conv.inboxId && ids.includes(conv.inboxId)) return { ok: true, value: conv };
  return { ok: false, response: notFound("Conversa") };
}

/** Verifica que o usuário pode acessar o contato (tem canal em Canal visível). */
export async function requireContactAccess(
  session: Session,
  contactId: string
): Promise<Result<{ id: string }>> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true },
  });
  if (!contact) return { ok: false, response: notFound("Contato") };
  if (session.user.role === "ADMIN") return { ok: true, value: contact };

  const ids = await visibleInboxIds(session.user);
  if (ids === null) return { ok: true, value: contact };

  const visible = await prisma.contactChannel.findFirst({
    where: { contactId, inboxId: { in: ids } },
    select: { id: true },
  });
  if (!visible) return { ok: false, response: notFound("Contato") };
  return { ok: true, value: contact };
}
