"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { useEcommerceStore, StoreSelector } from "@/components/ecommerce/use-store";

interface Review {
  id: string;
  product_name: string | null;
  customer_name: string | null;
  rating: number;
  comment: string | null;
  approved: boolean;
  review_date: string | null;
}

const PER_PAGE = 20;

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

export function AvaliacoesClient() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [avg, setAvg] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { stores, storeId, setStoreId } = useEcommerceStore();

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const sq = storeId ? `&store=${storeId}` : "";
      const res = await fetch(`/api/v1/ecommerce/reviews?page=${page}&limit=${PER_PAGE}${sq}`);
      if (res.ok) {
        const json = (await res.json()) as {
          data: Review[];
          meta: { total: number; avg_rating: number };
        };
        setReviews(json.data);
        setTotal(json.meta.total);
        setAvg(json.meta.avg_rating);
      }
    } finally {
      setLoading(false);
    }
  }, [page, storeId]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/ecommerce" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Avaliações</h1>
        <div className="ml-auto"><StoreSelector stores={stores} storeId={storeId} setStoreId={setStoreId} /></div>
      </div>

      <div className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 shrink-0">
        <div className="flex flex-col">
          <span className="text-2xl font-semibold text-foreground">{avg.toFixed(1)}</span>
          <Stars n={Math.round(avg)} />
        </div>
        <div className="text-sm text-muted-foreground">
          {total.toLocaleString("pt-BR")} avaliações
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shrink-0">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Avaliações recentes</h2>
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
        {loading && reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Nenhuma avaliação. Use “Sincronizar avaliações” em Configurações → Integrações.
          </p>
        ) : (
          <div className="flex flex-col">
            {reviews.map((r) => (
              <div key={r.id} className="px-4 py-3 border-b border-border last:border-0 flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Stars n={r.rating} />
                  <span className="text-sm font-medium text-foreground">{r.customer_name ?? "Cliente"}</span>
                  {r.product_name && (
                    <span className="text-xs text-muted-foreground">· {r.product_name}</span>
                  )}
                  {!r.approved && (
                    <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-yellow-500/10 text-yellow-600">
                      não aprovada
                    </span>
                  )}
                  {r.review_date && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(r.review_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
