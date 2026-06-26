import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import type { WbuyNewsletterRaw } from "@/lib/wbuy";
import { syncNewsletter } from "@/lib/wbuy-newsletter";

interface Body {
  subscribers?: WbuyNewsletterRaw[];
}

// Recebe inscritos já buscados na Wbuy (pelo N8N) e faz upsert.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Body;
  const subs = Array.isArray(body.subscribers) ? body.subscribers : [];
  const synced = await syncNewsletter(subs);

  return NextResponse.json({ data: { received: subs.length, synced } });
}
