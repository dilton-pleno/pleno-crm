"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Bell, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";

type PresetKey = "today" | "yesterday" | "7d" | "30d" | "custom";

interface Overview {
  period: { start: string; end: string };
  metrics: {
    total_spend: number;
    total_reach: number;
    total_clicks: number;
    avg_cpm: number;
    avg_ctr: number;
    avg_roas: number;
  };
  comparison: {
    spend_change_pct: number;
    reach_change_pct: number;
    clicks_change_pct: number;
  } | null;
  by_platform: { meta: { spend: number; reach: number }; google: { spend: number; reach: number } };
  series: Array<{ date: string; meta: number; google: number }>;
}

interface Campaign {
  campaign_id: string;
  name: string;
  platform: "meta" | "google";
  status: string | null;
  spend: number;
  reach: number;
  clicks: number;
  ctr: number;
  roas: number;
}

interface Ga4Data {
  series: Array<{ date: string; sessions: number; users: number; pageviews: number }>;
}

const PLATFORM_COLORS = { meta: "#1877f2", google: "#ea4335" };

function fmtCurrency(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: PresetKey): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);
  if (preset === "today") {
    // start = end = hoje
  } else if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (preset === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "30d") {
    start.setDate(start.getDate() - 29);
  }
  return { start: toDateStr(start), end: toDateStr(end) };
}

export function CampanhasClient() {
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [compare, setCompare] = useState(true);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ga4, setGa4] = useState<Ga4Data | null>(null);
  const [loading, setLoading] = useState(true);

  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({ key: "spend", order: "desc" });

  const qs = useMemo(
    () => `start=${range.start}&end=${range.end}`,
    [range.start, range.end]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, camp, g4] = await Promise.all([
        fetch(`/api/v1/analytics/overview?${qs}&compare=${compare}`).then((r) => r.json()),
        fetch(`/api/v1/analytics/campaigns?${qs}&sort=${sort.key}&order=${sort.order}&limit=100`).then((r) => r.json()),
        fetch(`/api/v1/analytics/ga4?${qs}`).then((r) => r.json()),
      ]);
      setOverview(ov.data ?? null);
      setCampaigns(camp.data ?? []);
      setGa4(g4.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [qs, compare, sort.key, sort.order]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const applyPreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const topClicks = useMemo(
    () => [...campaigns].sort((a, b) => b.clicks - a.clicks).slice(0, 10),
    [campaigns]
  );

  const pieData = overview
    ? [
        { name: "Meta", value: overview.by_platform.meta.spend },
        { name: "Google", value: overview.by_platform.google.spend },
      ]
    : [];

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-foreground">Campanhas</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodSelector
            preset={preset}
            range={range}
            onPreset={applyPreset}
            onCustom={(start, end) => {
              setPreset("custom");
              setRange({ start, end });
            }}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
              className="rounded border-border"
            />
            Comparar
          </label>
          <Link
            href="/campanhas/alertas"
            className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent text-foreground"
          >
            <Bell className="w-3.5 h-3.5" /> Alertas
          </Link>
        </div>
      </div>

      {loading && !overview ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando métricas...</p>
      ) : (
        <>
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Investimento" value={fmtCurrency(overview?.metrics.total_spend ?? 0)} change={overview?.comparison?.spend_change_pct} />
            <MetricCard label="Alcance" value={fmtNumber(overview?.metrics.total_reach ?? 0)} change={overview?.comparison?.reach_change_pct} />
            <MetricCard label="Cliques" value={fmtNumber(overview?.metrics.total_clicks ?? 0)} change={overview?.comparison?.clicks_change_pct} />
            <MetricCard label="CPM médio" value={fmtCurrency(overview?.metrics.avg_cpm ?? 0)} />
            <MetricCard label="CTR médio" value={`${(overview?.metrics.avg_ctr ?? 0).toFixed(2)}%`} />
            <MetricCard label="ROAS" value={`${(overview?.metrics.avg_roas ?? 0).toFixed(2)}x`} />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Investimento diário por plataforma">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={overview?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                  <Line type="monotone" dataKey="meta" stroke={PLATFORM_COLORS.meta} name="Meta" dot={false} />
                  <Line type="monotone" dataKey="google" stroke={PLATFORM_COLORS.google} name="Google" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Distribuição de investimento">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? PLATFORM_COLORS.meta : PLATFORM_COLORS.google} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Cliques por campanha (top 10)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topClicks} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={110} />
                  <Tooltip formatter={(v: number) => fmtNumber(v)} />
                  <Bar dataKey="clicks" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Sessões GA4 por dia">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ga4?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmtNumber(v)} />
                  <Line type="monotone" dataKey="sessions" stroke="#22c55e" name="Sessões" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Tabela de campanhas */}
          <CampaignsTable
            campaigns={campaigns}
            sort={sort}
            onSort={(key) =>
              setSort((s) => ({ key, order: s.key === key && s.order === "desc" ? "asc" : "desc" }))
            }
            rangeQs={qs}
          />
        </>
      )}
    </div>
  );
}

function PeriodSelector({
  preset,
  range,
  onPreset,
  onCustom,
}: {
  preset: PresetKey;
  range: { start: string; end: string };
  onPreset: (p: PresetKey) => void;
  onCustom: (start: string, end: string) => void;
}) {
  const presets: Array<{ key: PresetKey; label: string }> = [
    { key: "today", label: "Hoje" },
    { key: "yesterday", label: "Ontem" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
  ];
  return (
    <div className="flex items-center gap-1">
      {presets.map((p) => (
        <button
          key={p.key}
          onClick={() => onPreset(p.key)}
          className={`text-xs rounded-md px-2.5 py-1.5 border ${
            preset === p.key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={range.start}
        onChange={(e) => onCustom(e.target.value, range.end)}
        className="text-xs bg-card border border-border rounded-md px-2 py-1.5"
      />
      <span className="text-xs text-muted-foreground">→</span>
      <input
        type="date"
        value={range.end}
        onChange={(e) => onCustom(range.start, e.target.value)}
        className="text-xs bg-card border border-border rounded-md px-2 py-1.5"
      />
    </div>
  );
}

function MetricCard({ label, value, change }: { label: string; value: string; change?: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-base font-semibold text-foreground">{value}</span>
      {change !== undefined && (
        <span className={`text-[11px] flex items-center gap-0.5 ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <h3 className="text-xs font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}

interface DailyHistory {
  date: string;
  spend: number;
  clicks: number;
  reach: number;
  ctr: number;
  roas: number;
}

function CampaignsTable({
  campaigns,
  sort,
  onSort,
  rangeQs,
}: {
  campaigns: Campaign[];
  sort: { key: string; order: "asc" | "desc" };
  onSort: (key: string) => void;
  rangeQs: string;
}) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, DailyHistory[]>>({});
  const perPage = 20;

  const totalPages = Math.max(1, Math.ceil(campaigns.length / perPage));
  const paged = campaigns.slice((page - 1) * perPage, page * perPage);

  const toggleExpand = useCallback(
    async (id: string) => {
      if (expanded === id) {
        setExpanded(null);
        return;
      }
      setExpanded(id);
      if (!history[id]) {
        const res = await fetch(`/api/v1/analytics/campaigns/${id}?${rangeQs}`);
        if (res.ok) {
          const json = (await res.json()) as { data: { history: DailyHistory[] } };
          setHistory((h) => ({ ...h, [id]: json.data.history }));
        }
      }
    },
    [expanded, history, rangeQs]
  );

  const columns: Array<{ key: string; label: string; sortable: boolean }> = [
    { key: "name", label: "Campanha", sortable: true },
    { key: "platform", label: "Plataforma", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "spend", label: "Investimento", sortable: true },
    { key: "reach", label: "Alcance", sortable: true },
    { key: "clicks", label: "Cliques", sortable: true },
    { key: "ctr", label: "CTR", sortable: true },
    { key: "roas", label: "ROAS", sortable: true },
  ];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-6" />
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable && onSort(c.key)}
                  className={`text-left font-medium px-3 py-2 whitespace-nowrap ${c.sortable ? "cursor-pointer hover:text-foreground" : ""}`}
                >
                  {c.label}
                  {sort.key === c.key && (sort.order === "desc" ? " ↓" : " ↑")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
                  Nenhuma campanha no período
                </td>
              </tr>
            ) : (
              paged.map((c) => (
                <CampaignRow
                  key={c.campaign_id}
                  campaign={c}
                  expanded={expanded === c.campaign_id}
                  history={history[c.campaign_id]}
                  onToggle={() => void toggleExpand(c.campaign_id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs px-2 py-1 rounded hover:bg-accent disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs px-2 py-1 rounded hover:bg-accent disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  expanded,
  history,
  onToggle,
}: {
  campaign: Campaign;
  expanded: boolean;
  history: DailyHistory[] | undefined;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-border hover:bg-accent/40">
        <td className="px-1">
          <button onClick={onToggle} className="p-1 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </td>
        <td className="px-3 py-2 text-foreground max-w-[200px] truncate">{campaign.name}</td>
        <td className="px-3 py-2 capitalize">{campaign.platform}</td>
        <td className="px-3 py-2">{campaign.status ?? "—"}</td>
        <td className="px-3 py-2">{fmtCurrency(campaign.spend)}</td>
        <td className="px-3 py-2">{fmtNumber(campaign.reach)}</td>
        <td className="px-3 py-2">{fmtNumber(campaign.clicks)}</td>
        <td className="px-3 py-2">{campaign.ctr.toFixed(2)}%</td>
        <td className="px-3 py-2">{campaign.roas.toFixed(2)}x</td>
      </tr>
      {expanded && (
        <tr className="bg-muted/30">
          <td colSpan={9} className="px-6 py-3">
            {!history ? (
              <p className="text-xs text-muted-foreground">Carregando histórico...</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-medium py-1">Data</th>
                    <th className="text-left font-medium py-1">Investimento</th>
                    <th className="text-left font-medium py-1">Alcance</th>
                    <th className="text-left font-medium py-1">Cliques</th>
                    <th className="text-left font-medium py-1">CTR</th>
                    <th className="text-left font-medium py-1">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date}>
                      <td className="py-1">{h.date}</td>
                      <td className="py-1">{fmtCurrency(h.spend)}</td>
                      <td className="py-1">{fmtNumber(h.reach)}</td>
                      <td className="py-1">{fmtNumber(h.clicks)}</td>
                      <td className="py-1">{h.ctr.toFixed(2)}%</td>
                      <td className="py-1">{h.roas.toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
