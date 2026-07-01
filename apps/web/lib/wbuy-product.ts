import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WbuyProductRaw } from "@/lib/wbuy";

/**
 * Extrai preço (tabela Varejo, id 1), estoque total e visualizações das
 * variações em estoque[].
 */
function summarizeStock(estoque: WbuyProductRaw["estoque"]): {
  price: number;
  stock: number;
  views: number;
} {
  let price = 0;
  let stock = 0;
  let views = 0;
  for (const v of estoque ?? []) {
    stock += Number(v.quantidade_em_estoque ?? 0);
    views += Number(v.visualizacoes ?? 0);
    if (price === 0) {
      const varejo = v.valores?.find((x) => x.tabela_id === "1") ?? v.valores?.[0];
      if (varejo?.valor) price = Number(varejo.valor);
    }
  }
  return { price, stock, views };
}

/**
 * Upsert de um produto ativo da Wbuy (chave: external_id). Guarda só o que é
 * útil para cruzar vendas e SEO.
 */
export async function upsertWbuyProduct(p: WbuyProductRaw, storeIntegrationId: string): Promise<void> {
  if (!p.id) return;
  const { price, stock, views } = summarizeStock(p.estoque);

  const data = {
    storeIntegrationId,
    cod: p.cod ?? null,
    name: p.produto ?? "Produto",
    description: p.descricao ?? null,
    brand: p.marca?.nome ?? null,
    category: p.categoria_level1?.nome ?? null,
    categoryUrl: p.categoria_level1?.url ?? null,
    gtin: p.gtin ?? null,
    ncm: p.ncm ?? null,
    price: new Prisma.Decimal(price),
    stock,
    views,
    active: p.ativo !== "0",
    syncedAt: new Date(),
  };

  await prisma.wbuyProduct.upsert({
    where: { storeIntegrationId_externalId: { storeIntegrationId, externalId: String(p.id) } },
    update: data,
    create: { ...data, externalId: String(p.id) },
  });
}
