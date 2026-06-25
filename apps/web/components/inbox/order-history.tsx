"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingBag, ChevronDown, ChevronRight } from "lucide-react";

interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  external_id: string;
  status: string;
  total: number;
  created_at: string;
  items: OrderItem[];
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (/(pago|aprovad|entregue|conclu)/.test(s)) return "bg-green-500/10 text-green-600";
  if (/(cancel|estorn|recus|expir)/.test(s)) return "bg-red-500/10 text-red-600";
  if (/(aguard|pendente|process|autoriz)/.test(s)) return "bg-yellow-500/10 text-yellow-600";
  return "bg-muted text-muted-foreground";
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrderHistory({ contactId, compact = false }: { contactId: string; compact?: boolean }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/contacts/${contactId}/orders`);
      if (res.ok) {
        const json = (await res.json()) as { data: Order[] };
        setOrders(json.data);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    }
  }, [contactId]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  if (orders === null) {
    return <p className="text-xs text-muted-foreground">Carregando pedidos...</p>;
  }

  if (orders.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum pedido encontrado.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => {
        const open = expanded === o.id;
        return (
          <div key={o.id} className="border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setExpanded(open ? null : o.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-accent/40 text-left"
            >
              {open ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-foreground truncate flex-1">
                #{o.external_id}
              </span>
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${statusColor(o.status)}`}>
                {o.status}
              </span>
              <span className="text-xs text-foreground">{fmtCurrency(o.total)}</span>
            </button>
            {open && (
              <div className="px-3 py-2 bg-muted/30 border-t border-border flex flex-col gap-1">
                <p className="text-[10px] text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
                {o.items.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Sem itens detalhados.</p>
                ) : (
                  o.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-[11px]">
                      <span className="text-foreground truncate">
                        {it.quantity}× {it.name}
                      </span>
                      <span className="text-muted-foreground flex-shrink-0">
                        {fmtCurrency(it.unit_price)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
      {!compact && orders.length >= 5 && (
        <p className="text-[10px] text-muted-foreground">Mostrando os 5 mais recentes.</p>
      )}
    </div>
  );
}
