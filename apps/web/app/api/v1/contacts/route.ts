import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { visibleInboxIds } from "@/lib/visibility";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("contatos");
  if (!guard.ok) return guard.response;

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10)));
  const skip = (page - 1) * limit;

  const digits = search?.replace(/\D/g, "");
  const where: Prisma.ContactWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          ...(digits && digits.length >= 3
            ? [
                { phone: { contains: digits } },
                { document: { contains: digits } },
              ]
            : []),
        ],
      }
    : {};

  // Visibilidade por time: só contatos com algum canal em um Canal visível.
  const visible = await visibleInboxIds(guard.session.user);
  if (visible) {
    where.channels = { some: { inboxId: { in: visible } } };
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        channels: { select: { id: true, channelType: true } },
        tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  const data = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    avatar_url: c.avatarUrl,
    city: c.city,
    uf: c.uf,
    channels: c.channels.map((ch) => ({ id: ch.id, channel_type: ch.channelType })),
    tags: c.tags,
    last_interaction_at: c.conversations[0]?.updatedAt.toISOString() ?? null,
  }));

  return NextResponse.json({ data, meta: { total, page, limit } });
}
