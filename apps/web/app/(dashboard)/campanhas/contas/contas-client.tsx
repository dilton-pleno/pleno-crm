"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone } from "lucide-react";

interface StoreOpt {
  id: string;
  name: string;
}

interface AdAccount {
  id: string;
  platform: string;
  account_id: string;
  store_integration_id: string;
  store_name: string;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  ga4: "Google Analytics (GA4)",
};

export function ContasClient({ canManage }: { canManage: boolean }) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/analytics/ad-accounts");
      if (res.ok) {
        const json = (await res.json()) as {
          data: { accounts: AdAccount[]; stores: StoreOpt[] };
        };
        setAccounts(json.data.accounts);
        setStores(json.data.stores);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const reassign = async (id: string, storeId: string) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/v1/analytics/ad-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_integration_id: storeId }),
      });
      if (res.ok) {
        const store = stores.find((s) => s.id === storeId);
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, store_integration_id: storeId, store_name: store?.name ?? a.store_name }
              : a
          )
        );
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/campanhas" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Contas de anúncio</h1>
      </div>

      <p className="text-xs text-muted-foreground shrink-0">
        Cada conta de anúncio (Meta, Google, GA4) pertence a uma loja. O ROI da tela Marketing
        cruza o faturamento da loja com o investimento das contas vinculadas a ela. Reatribuir uma
        conta move também o histórico de métricas dela para a loja escolhida.
      </p>

      <div className="bg-card border border-border rounded-lg overflow-hidden shrink-0">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Nenhuma conta de anúncio detectada ainda. Elas aparecem aqui após a primeira
            sincronização de Meta Ads, Google Ads ou GA4.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left font-medium px-4 py-2">Plataforma</th>
                <th className="text-left font-medium px-3 py-2">Conta</th>
                <th className="text-left font-medium px-4 py-2">Loja</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
                      {PLATFORM_LABEL[a.platform] ?? a.platform}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground font-mono">{a.account_id}</td>
                  <td className="px-4 py-2.5">
                    {canManage ? (
                      <select
                        value={a.store_integration_id}
                        disabled={savingId === a.id}
                        onChange={(e) => void reassign(a.id, e.target.value)}
                        className="text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                      >
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-foreground">{a.store_name}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
