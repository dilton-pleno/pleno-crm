"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Eye } from "lucide-react";

interface Product {
  id: string;
  external_id: string;
  cod: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  price: number;
  stock: number;
  views: number;
  active: boolean;
  has_description: boolean;
  has_gtin: boolean;
  units_sold: number;
  revenue: number;
}

type SortKey = "units" | "revenue" | "name" | "stock" | "views";

const PER_PAGE = 20;

function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function ProdutosClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<SortKey>("units");
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PER_PAGE), sort });
      if (search) qs.set("search", search);
      const res = await fetch(`/api/v1/ecommerce/products?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as { data: Product[]; meta: { total: number } };
        setProducts(json.data);
        setTotal(json.meta.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, sort]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => {
        setPage(1);
        setSort(key);
      }}
      className={`text-xs rounded-md px-2.5 py-1.5 border ${
        sort === key
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/ecommerce" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Produtos ativos</h1>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Ordenar:</span>
          {sortBtn("units", "Mais vendidos")}
          {sortBtn("revenue", "Faturamento")}
          {sortBtn("stock", "Estoque")}
          {sortBtn("views", "Visualizações")}
          {sortBtn("name", "Nome")}
        </div>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              setSearch(searchInput.trim());
            }
          }}
          placeholder="Buscar por nome, código ou marca…"
          className="text-xs bg-background border border-border rounded-md px-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden shrink-0">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Produtos <span className="text-muted-foreground font-normal">({fmtNumber(total)})</span>
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs border border-border rounded-md px-2 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                ‹
              </button>
              <span className="text-xs text-muted-foreground px-1">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-xs border border-border rounded-md px-2 py-1.5 hover:bg-accent disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {loading && products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            {search
              ? "Nenhum produto encontrado."
              : "Nenhum produto sincronizado. Use “Sincronizar produtos” em Configurações → Integrações."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SeoBadge({ product }: { product: Product }) {
  if (product.has_description && product.has_gtin) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
        SEO OK
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-yellow-600"
      title={`${!product.has_description ? "Sem descrição. " : ""}${!product.has_gtin ? "Sem GTIN." : ""}`}
    >
      <AlertTriangle className="w-3 h-3" />
      {!product.has_description ? "sem descrição" : "sem GTIN"}
    </span>
  );
}

function ProductCard({ product: p }: { product: Product }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2 hover:border-primary/40 transition-colors">
      {/* Topo: nome + código + marca */}
      <div className="flex flex-col gap-0.5 min-h-[44px]">
        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug" title={p.name}>
          {p.name}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {p.cod && <span>#{p.cod}</span>}
          {p.cod && p.brand && <span>·</span>}
          {p.brand && <span className="truncate">{p.brand}</span>}
        </div>
      </div>

      {/* Preço em destaque */}
      <p className="text-base font-semibold text-foreground">{fmtCurrency(p.price)}</p>

      {/* Rodapé: estatísticas */}
      <div className="mt-auto pt-2 border-t border-border grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px]">
        <div className="flex flex-col">
          <span className="text-muted-foreground">Vendidos</span>
          <span className="text-foreground font-medium">{fmtNumber(p.units_sold)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Faturamento</span>
          <span className="text-foreground font-medium">{fmtCurrency(p.revenue)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Estoque</span>
          <span className="text-foreground">{fmtNumber(p.stock)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Views</span>
          <span className="text-foreground inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> {fmtNumber(p.views)}
          </span>
        </div>
      </div>

      <div className="pt-1">
        <SeoBadge product={p} />
      </div>
    </div>
  );
}
