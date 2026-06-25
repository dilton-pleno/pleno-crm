"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ShoppingCart, DollarSign, Package } from "lucide-react";

interface RecentOrder {
  id: string;
  external_id: string;
  contact_id: string;
  contact_name: string;
  status: string;
  total: number;
  created_at: string;
}

interface Overview {
  revenue_30d: number;
  orders_30d: number;
  total_orders: number;
  recent: RecentOrder[];
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}
function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (/(pago|aprovad|entregue|conclu)/.test(s)) return "bg-green-500/10 text-green-600";
  if (/(cancel|estorn|recus|expir)/.test(s)) return "bg-red-500/10 text-red-600";
  if (/(aguard|pendente|process|autoriz|transporte|enviado)/.test(s)) return "bg-yellow-500/10 text-yellow-600";
  return "bg-muted text-muted-foreground";
}

export function EcommerceClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ecommerce/overview");
      if (res.ok) {
        const json = (await res.json()) as { data: Overview };
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-5xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-foreground">Ecommerce</h1>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat icon={DollarSign} label="Faturamento (30 dias)" value={fmtCurrency(data?.revenue_30d ?? 0)} />
            <Stat icon={ShoppingCart} label="Pedidos (30 dias)" value={fmtNumber(data?.orders_30d ?? 0)} />
            <Stat icon={Package} label="Pedidos no total" value={fmtNumber(data?.total_orders ?? 0)} />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Pedidos recentes</h2>
            </div>
            {!data || data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Nenhum pedido sincronizado. Use “Sincronizar pedidos” em Configurações → Integrações.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left font-medium px-4 py-2">Pedido</th>
                      <th className="text-left font-medium px-4 py-2">Cliente</th>
                      <th className="text-left font-medium px-4 py-2">Status</th>
                      <th className="text-left font-medium px-4 py-2">Data</th>
                      <th className="text-right font-medium px-4 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((o) => (
                      <tr key={o.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2 text-foreground">#{o.external_id}</td>
                        <td className="px-4 py-2">
                          <Link href={`/contatos/${o.contact_id}`} className="text-primary hover:underline">
                            {o.contact_name}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${statusColor(o.status)}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-2 text-right text-foreground">{fmtCurrency(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-base font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}
