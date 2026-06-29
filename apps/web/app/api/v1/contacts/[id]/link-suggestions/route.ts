import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { requireContactAccess } from "@/lib/resource-access";
import { prisma } from "@/lib/prisma";

/**
 * Sugere contatos que podem ser a mesma pessoa em outro canal.
 * Heurística: mesmo nome (case-insensitive), contato diferente do atual,
 * com pelo menos um canal de tipo distinto dos canais do contato atual.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireAccess("contatos");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const access = await requireContactAccess(guard.session, id);
  if (!access.ok) return access.response;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { channels: { select: { channelType: true } } },
  });
  if (!contact) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Contato não encontrado" } },
      { status: 404 }
    );
  }

  const ownTypes = new Set(contact.channels.map((c) => c.channelType));

  const candidates = await prisma.contact.findMany({
    where: {
      id: { not: id },
      name: { equals: contact.name, mode: "insensitive" },
    },
    include: {
      channels: { select: { channelType: true, channelIdentifier: true } },
    },
    take: 5,
  });

  const data = candidates
    .map((cand) => {
      // Canais que o contato atual ainda não possui.
      const newChannels = cand.channels.filter((ch) => !ownTypes.has(ch.channelType));
      return { cand, newChannels };
    })
    .filter(({ newChannels }) => newChannels.length > 0)
    .map(({ cand, newChannels }) => ({
      contact_id: cand.id,
      name: cand.name,
      channels: newChannels.map((ch) => ({
        channel_type: ch.channelType,
        channel_identifier: ch.channelIdentifier,
      })),
    }));

  return NextResponse.json({ data });
}
