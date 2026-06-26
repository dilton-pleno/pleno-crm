import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import type { WbuyCustomerRaw } from "@/lib/wbuy";
import { syncCustomers } from "@/lib/wbuy-customer";

interface Body {
  customers?: WbuyCustomerRaw[];
}

// Recebe clientes já buscados na Wbuy (pelo N8N) e enriquece os contatos.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Body;
  const customers = Array.isArray(body.customers) ? body.customers : [];
  const { enriched, skipped } = await syncCustomers(customers);

  return NextResponse.json({ data: { received: customers.length, enriched, skipped } });
}
