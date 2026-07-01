import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireInternalSecret } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { getGoogleConfig } from "@/lib/google-config";
import { resolveAdStoreId } from "@/lib/ads-store";

const rowSchema = z.object({
  sessions: z.number().int().nonnegative().default(0),
  users: z.number().int().nonnegative().default(0),
  pageviews: z.number().int().nonnegative().default(0),
  bounce_rate: z.number().nonnegative().default(0),
  source: z.string().optional().nullable(),
  medium: z.string().optional().nullable(),
});

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(rowSchema),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  const { date, rows } = parsed.data;
  const day = new Date(`${date}T00:00:00.000Z`);

  // Loja dona da property GA4 configurada (mapa conta→loja; fallback loja padrão).
  const { ga4PropertyId } = await getGoogleConfig();
  const storeIntegrationId = await resolveAdStoreId("ga4", ga4PropertyId);

  // source/medium compõem a chave única; normalizamos null para evitar que o
  // Postgres trate NULLs como distintos e duplique linhas.
  for (const r of rows) {
    const source = r.source ?? "unknown";
    const medium = r.medium ?? "unknown";
    const data = {
      date: day,
      source,
      medium,
      storeIntegrationId,
      sessions: r.sessions,
      users: r.users,
      pageviews: r.pageviews,
      bounceRate: new Prisma.Decimal(r.bounce_rate),
    };
    await prisma.ga4Metric.upsert({
      where: { date_source_medium: { date: day, source, medium } },
      update: data,
      create: data,
    });
  }

  return NextResponse.json({ data: { synced: rows.length, upserted: rows.length } });
}
