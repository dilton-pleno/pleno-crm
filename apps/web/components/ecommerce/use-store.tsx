"use client";

import { useState, useEffect } from "react";
import { Store } from "lucide-react";

export interface StoreOpt {
  id: string;
  name: string;
}

const KEY = "ecommerce_store";

/**
 * Seleção de loja (integração e-commerce) compartilhada entre as telas de
 * Ecommerce, persistida em localStorage. storeId "" = loja padrão no backend.
 */
export function useEcommerceStore() {
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [storeId, setStoreIdState] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/ecommerce/stores")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const list = (j.data ?? []) as StoreOpt[];
        setStores(list);
        const saved = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
        const valid = saved && list.some((s) => s.id === saved) ? saved : list[0]?.id ?? "";
        setStoreIdState(valid);
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      active = false;
    };
  }, []);

  const setStoreId = (id: string) => {
    setStoreIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(KEY, id);
  };

  return { stores, storeId, setStoreId, ready };
}

/** Seletor de loja — some quando há uma única loja (nada a escolher). */
export function StoreSelector({
  stores,
  storeId,
  setStoreId,
}: {
  stores: StoreOpt[];
  storeId: string;
  setStoreId: (id: string) => void;
}) {
  if (stores.length <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Store className="w-4 h-4 text-muted-foreground" />
      <select
        value={storeId}
        onChange={(e) => setStoreId(e.target.value)}
        className="text-xs bg-card border border-border rounded-md px-2 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
