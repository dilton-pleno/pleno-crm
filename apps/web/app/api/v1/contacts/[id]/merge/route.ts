import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  source_contact_id: z.string().uuid(),
});

/**
 * Vincula (mescla) dois contatos: move canais, conversas, cards e pedidos do
 * contato de origem para o contato atual (destino) e remove a origem, deixando
 * o histórico unificado na linha do tempo do destino. (Módulo 2.5)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos", "full");
  if (!guard.ok) return guard.response;

  const { id: targetId } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const sourceId = parsed.data.source_contact_id;
  if (sourceId === targetId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Origem e destino são o mesmo contato" } },
      { status: 422 }
    );
  }

  const [target, source] = await Promise.all([
    prisma.contact.findUnique({ where: { id: targetId } }),
    prisma.contact.findUnique({ where: { id: sourceId } }),
  ]);

  if (!target || !source) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Contato de origem ou destino não encontrado" } },
      { status: 404 }
    );
  }

  await prisma.$transaction([
    prisma.contactChannel.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    prisma.conversation.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    prisma.pipelineCard.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    prisma.order.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } }),
    // Preenche dados ausentes do destino com os da origem.
    prisma.contact.update({
      where: { id: targetId },
      data: {
        phone: target.phone ?? source.phone,
        email: target.email ?? source.email,
        avatarUrl: target.avatarUrl ?? source.avatarUrl,
        notes: target.notes ?? source.notes,
      },
    }),
    prisma.contact.delete({ where: { id: sourceId } }),
  ]);

  const merged = await prisma.contact.findUnique({
    where: { id: targetId },
    include: { channels: { select: { id: true, channelType: true, channelIdentifier: true } } },
  });

  return NextResponse.json({ data: merged }, { status: 200 });
}
