import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import type { WbuyNewsletterRaw } from "@/lib/wbuy";
import { syncNewsletter } from "@/lib/wbuy-newsletter";
import { getDefaultStoreIntegrationId } from "@/lib/store-integration";

interface Body {
  subscribers?: WbuyNewsletterRaw[];
}

// Recebe inscritos já buscados na Wbuy (pelo N8N) e faz upsert.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const storeId = await getDefaultStoreIntegrationId();
  if (!storeId) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Nenhuma loja e-commerce configurada" } }, { status: 400 });
  }

  const body = (await request.json()) as Body;
  const subs = Array.isArray(body.subscribers) ? body.subscribers : [];
  const synced = await syncNewsletter(subs, storeId);

  return NextResponse.json({ data: { received: subs.length, synced } });
}
