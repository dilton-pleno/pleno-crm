import { prisma } from "@/lib/prisma";
import { mergeContacts } from "@/lib/contact-merge";

/** Normaliza o @ do Instagram: minúsculo, sem "@" e sem espaços. */
export function normalizeHandle(username: string | null | undefined): string | null {
  if (!username) return null;
  const h = username.trim().toLowerCase().replace(/^@+/, "").replace(/\s/g, "");
  return h || null;
}

/**
 * Após ingerir um Direct do Instagram, grava o @ no contato e, se já existir
 * OUTRO contato com o mesmo @ (ex.: contato de WhatsApp preenchido pelo agente),
 * unifica os dois automaticamente — mesclando o contato do IG no já existente.
 */
export async function linkInstagramHandle(
  igSenderId: string,
  username: string | null | undefined
): Promise<void> {
  const handle = normalizeHandle(username);
  if (!handle) return;

  const channel = await prisma.contactChannel.findUnique({
    where: { channelType_channelIdentifier: { channelType: "instagram", channelIdentifier: igSenderId } },
    select: { contactId: true },
  });
  if (!channel) return;
  const currentId = channel.contactId;

  // Outro contato (não o do IG atual) já marcado com esse @.
  const match = await prisma.contact.findFirst({
    where: { instagramHandle: handle, id: { not: currentId } },
    select: { id: true },
  });

  if (match) {
    // Mescla o contato do IG (origem) no já existente (destino) e garante o @.
    const ok = await mergeContacts(match.id, currentId);
    if (ok) {
      await prisma.contact.update({ where: { id: match.id }, data: { instagramHandle: handle } });
      return;
    }
  }

  // Sem match: apenas grava o @ no contato do IG (se ainda não tiver).
  await prisma.contact.updateMany({
    where: { id: currentId, instagramHandle: null },
    data: { instagramHandle: handle },
  });
}
