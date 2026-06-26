import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { getWbuyCreds } from "@/lib/wbuy-config";
import { getCustomers } from "@/lib/wbuy";
import { syncCustomers } from "@/lib/wbuy-customer";

const PAGE_SIZE = 100;
const MAX_PAGES = 1000;

// Enriquece contatos existentes com os dados dos clientes da Wbuy (paginado).
// Não cria contatos novos. Admin.
export async function POST(): Promise<NextResponse> {
  const guard = await requireAccess("configuracoes", "full");
  if (!guard.ok) return guard.response;

  const creds = await getWbuyCreds();
  if (!creds) {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Credenciais Wbuy não configuradas" } },
      { status: 400 }
    );
  }

  try {
    let enriched = 0;
    let scanned = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      const customers = await getCustomers(creds, { limit: `${offset},${PAGE_SIZE}` });
      if (customers.length === 0) break;
      scanned += customers.length;
      const res = await syncCustomers(customers);
      enriched += res.enriched;
      if (customers.length < PAGE_SIZE) break;
    }
    return NextResponse.json({ data: { scanned, enriched } });
  } catch (err) {
    console.error("[wbuy] Erro ao sincronizar clientes:", err);
    return NextResponse.json(
      { error: { code: "WBUY_ERROR", message: "Falha ao sincronizar clientes" } },
      { status: 502 }
    );
  }
}
