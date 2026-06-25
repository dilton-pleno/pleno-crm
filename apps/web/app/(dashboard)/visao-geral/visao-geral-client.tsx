"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  MessageCircle,
  BarChart2,
  ShoppingCart,
  ArrowRight,
  Inbox,
  Clock,
  CheckCircle2,
  Bell,
} from "lucide-react";

interface OverviewData {
  atendimento: {
    open: number;
    pending: number;
    resolved: number;
    unread: number;
    new_last_7_days: number;
  };
  campanhas: { spend: number; clicks: number; reach: number; roas: number } | null;
  ecommerce: { integrated: boolean; orders: number; revenue: number } | null;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function VisaoGeralClient({ userName }: { userName: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/overview");
      if (res.ok) {
        const json = (await res.json()) as { data: OverviewData };
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const firstName = userName.split(" ")[0] ?? userName;

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Olá, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação</p>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando...</p>
      ) : (
        <>
          {/* Atendimento */}
          <Section
            title="Atendimento"
            icon={MessageCircle}
            href="/atendimento"
            linkLabel="Ir para o atendimento"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={Inbox} label="Em aberto" value={fmtNumber(data?.atendimento.open ?? 0)} accent="text-blue-600" />
              <Stat icon={Clock} label="Pendentes" value={fmtNumber(data?.atendimento.pending ?? 0)} accent="text-orange-500" />
              <Stat icon={CheckCircle2} label="Resolvidas" value={fmtNumber(data?.atendimento.resolved ?? 0)} accent="text-green-600" />
              <Stat icon={Bell} label="Não lidas" value={fmtNumber(data?.atendimento.unread ?? 0)} accent="text-red-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {fmtNumber(data?.atendimento.new_last_7_days ?? 0)} novas conversas nos últimos 7 dias
            </p>
          </Section>

          {/* Campanhas (apenas quem tem acesso) */}
          {data?.campanhas && (
            <Section
              title="Campanhas (30 dias)"
              icon={BarChart2}
              href="/campanhas"
              linkLabel="Ver dashboard de campanhas"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Investimento" value={fmtCurrency(data.campanhas.spend)} />
                <Stat label="Cliques" value={fmtNumber(data.campanhas.clicks)} />
                <Stat label="Alcance" value={fmtNumber(data.campanhas.reach)} />
                <Stat label="ROAS" value={`${data.campanhas.roas.toFixed(2)}x`} />
              </div>
            </Section>
          )}

          {/* Ecommerce (apenas Admin/Gestor) */}
          {data?.ecommerce && (
            <Section title="Ecommerce" icon={ShoppingCart} href="/ecommerce" linkLabel="Abrir ecommerce">
              {data.ecommerce.integrated ? (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Pedidos" value={fmtNumber(data.ecommerce.orders)} />
                  <Stat label="Receita" value={fmtCurrency(data.ecommerce.revenue)} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Integração com a Wbuy em desenvolvimento (Módulo 5). Pedidos e receita
                  aparecerão aqui em breve.
                </p>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: React.ElementType;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {linkLabel} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-background border border-border rounded-md p-3 flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className={`w-3 h-3 ${accent ?? ""}`} />}
        {label}
      </span>
      <span className="text-base font-semibold text-foreground">{value}</span>
    </div>
  );
}
