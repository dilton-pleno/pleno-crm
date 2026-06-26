import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import type { WbuyProductRaw } from "@/lib/wbuy";
import { upsertWbuyProduct } from "@/lib/wbuy-product";

interface Body {
  products?: WbuyProductRaw[];
}

// Recebe produtos ativos já buscados na Wbuy (pelo N8N) e faz upsert.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Body;
  const products = Array.isArray(body.products) ? body.products : [];

  let synced = 0;
  for (const p of products) {
    if (!p?.id) continue;
    try {
      await upsertWbuyProduct(p);
      synced++;
    } catch (err) {
      console.error(`[sync/wbuy-products] Falha no produto ${p.id}:`, err);
    }
  }

  return NextResponse.json({ data: { received: products.length, synced } });
}
