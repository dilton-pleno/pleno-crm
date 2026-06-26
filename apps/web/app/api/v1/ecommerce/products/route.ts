import { NextRequest, NextResponse } from "next/server";
import { requireAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { dec } from "@/lib/analytics-query";

interface SalesRow {
  pid: string;
  units: number;
  revenue: number;
}

type SortKey = "units" | "revenue" | "name" | "stock" | "views";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("ecommerce");
  if (!guard.ok) return guard.response;

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
  const search = params.get("search")?.trim();
  const sort = (params.get("sort") as SortKey) ?? "units";

  // Cruzamento de vendas: agrega itens de pedidos por id de produto, derivado
  // do prefixo do SKU (ex.: "5307.0006.0" -> "5307").
  const salesRows = await prisma.$queryRaw<SalesRow[]>`
    SELECT split_part(item->>'sku', '.', 1) AS pid,
           SUM((item->>'quantity')::numeric)::int AS units,
           SUM((item->>'quantity')::numeric * (item->>'unit_price')::numeric)::float8 AS revenue
    FROM orders, jsonb_array_elements(items) AS item
    WHERE items IS NOT NULL AND item->>'sku' IS NOT NULL
    GROUP BY pid
  `;
  const salesMap = new Map<string, { units: number; revenue: number }>();
  for (const r of salesRows) {
    salesMap.set(r.pid, { units: Number(r.units), revenue: Number(r.revenue) });
  }

  const products = await prisma.wbuyProduct.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { cod: { contains: search } },
            { brand: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
  });

  const merged = products.map((p) => {
    const s = salesMap.get(p.externalId) ?? { units: 0, revenue: 0 };
    return {
      id: p.id,
      external_id: p.externalId,
      cod: p.cod,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: dec(p.price),
      stock: p.stock,
      views: p.views,
      active: p.active,
      has_description: Boolean(p.description && p.description.trim().length > 0),
      has_gtin: Boolean(p.gtin && p.gtin.trim().length > 0),
      units_sold: s.units,
      revenue: Math.round(s.revenue * 100) / 100,
    };
  });

  merged.sort((a, b) => {
    switch (sort) {
      case "name":
        return a.name.localeCompare(b.name);
      case "stock":
        return b.stock - a.stock;
      case "views":
        return b.views - a.views;
      case "revenue":
        return b.revenue - a.revenue;
      default:
        return b.units_sold - a.units_sold;
    }
  });

  const total = merged.length;
  const paged = merged.slice((page - 1) * limit, (page - 1) * limit + limit);

  return NextResponse.json({ data: paged, meta: { total, page, limit } });
}
