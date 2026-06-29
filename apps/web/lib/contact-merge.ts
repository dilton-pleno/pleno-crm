import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Mescla dois contatos: move canais, conversas, cards, pedidos, notas e
 * etiquetas do `sourceId` para o `targetId`, preenche dados ausentes do destino
 * e apaga a origem. Usado pela rota de "vincular contato" e pela unificação
 * automática por @ do Instagram.
 *
 * Retorna false se algo não existir ou se origem == destino.
 */
export async function mergeContacts(targetId: string, sourceId: string): Promise<boolean> {
  if (targetId === sourceId) return false;

  const [target, source] = await Promise.all([
    prisma.contact.findUnique({ where: { id: targetId } }),
    prisma.contact.findUnique({ where: { id: sourceId }, include: { tags: { select: { id: true } } } }),
  ]);
  if (!target || !source) return false;

  const fill = <T>(a: T | null, b: T | null): T | null => a ?? b;

  await prisma.$transaction([
    prisma.contactChannel.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    prisma.conversation.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    prisma.pipelineCard.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    prisma.order.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    prisma.contactNote.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    // Preenche dados ausentes do destino + leva as etiquetas da origem.
    prisma.contact.update({
      where: { id: targetId },
      data: {
        phone: fill(target.phone, source.phone),
        email: fill(target.email, source.email),
        avatarUrl: fill(target.avatarUrl, source.avatarUrl),
        notes: fill(target.notes, source.notes),
        document: fill(target.document, source.document),
        document2: fill(target.document2, source.document2),
        birthDate: fill(target.birthDate, source.birthDate),
        gender: fill(target.gender, source.gender),
        city: fill(target.city, source.city),
        uf: fill(target.uf, source.uf),
        secondaryPhone: fill(target.secondaryPhone, source.secondaryPhone),
        wbuyCustomerId: fill(target.wbuyCustomerId, source.wbuyCustomerId),
        instagramHandle: fill(target.instagramHandle, source.instagramHandle),
        ...(target.addresses == null && source.addresses != null
          ? { addresses: source.addresses as unknown as Prisma.InputJsonValue }
          : {}),
        tags: { connect: source.tags.map((t) => ({ id: t.id })) },
      },
    }),
    prisma.contact.delete({ where: { id: sourceId } }),
  ]);

  return true;
}
