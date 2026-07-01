import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getEcommerceStores } from "@/lib/store-integration";

// Lista o mapa conta de anúncio → loja (para atribuição no painel) + as lojas
// disponíveis para o seletor. Leitura liberada a quem acessa Marketing.
export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("campanhas");
  if (!guard.ok) return guard.response;

  const [accounts, stores] = await Promise.all([
    prisma.adAccountStore.findMany({
      orderBy: [{ platform: "asc" }, { accountId: "asc" }],
      select: {
        id: true,
        platform: true,
        accountId: true,
        storeIntegrationId: true,
        store: { select: { name: true } },
      },
    }),
    getEcommerceStores(),
  ]);

  return NextResponse.json({
    data: {
      accounts: accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        account_id: a.accountId,
        store_integration_id: a.storeIntegrationId,
        store_name: a.store.name,
      })),
      stores,
    },
  });
}
