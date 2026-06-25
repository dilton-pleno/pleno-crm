import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireInternalSecret } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";

const productSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  issues: z.unknown().optional(),
  clicks: z.number().int().nonnegative().default(0),
  impressions: z.number().int().nonnegative().default(0),
});

const schema = z.object({
  products: z.array(productSchema),
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

  const { products } = parsed.data;

  for (const p of products) {
    const data = {
      externalId: p.id,
      title: p.title,
      status: p.status,
      issues:
        p.issues === undefined
          ? Prisma.JsonNull
          : (p.issues as Prisma.InputJsonValue),
      clicks: p.clicks,
      impressions: p.impressions,
      syncedAt: new Date(),
    };
    await prisma.merchantProduct.upsert({
      where: { externalId: p.id },
      update: data,
      create: data,
    });
  }

  return NextResponse.json({ data: { synced: products.length, upserted: products.length } });
}
