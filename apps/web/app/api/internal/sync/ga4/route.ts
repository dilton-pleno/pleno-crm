import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalSecret } from "@/lib/internal-auth";
import { upsertGa4Rows } from "@/lib/ga4-sync";

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

  // Adapta o payload (data no topo, bounce_rate) para o formato Ga4Row e delega
  // o upsert + carimbo de loja ao helper compartilhado.
  const synced = await upsertGa4Rows(
    rows.map((r) => ({
      date,
      source: r.source ?? null,
      medium: r.medium ?? null,
      sessions: r.sessions,
      users: r.users,
      pageviews: r.pageviews,
      bounceRate: r.bounce_rate,
    }))
  );

  return NextResponse.json({ data: { synced, upserted: synced } });
}
