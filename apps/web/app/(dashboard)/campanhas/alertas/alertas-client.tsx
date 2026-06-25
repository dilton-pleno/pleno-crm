"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, ArrowLeft, BellRing } from "lucide-react";

type Platform = "meta" | "google" | "both";
type Metric = "spend" | "reach" | "clicks" | "cpm" | "ctr" | "roas" | "conversions";
type Operator = "gt" | "lt" | "eq";

interface Alert {
  id: string;
  name: string;
  platform: Platform;
  metric: Metric;
  operator: Operator;
  threshold: number;
  active: boolean;
}

const PLATFORM_LABEL: Record<Platform, string> = { meta: "Meta", google: "Google", both: "Ambos" };
const METRIC_LABEL: Record<Metric, string> = {
  spend: "Investimento",
  reach: "Alcance",
  clicks: "Cliques",
  cpm: "CPM",
  ctr: "CTR",
  roas: "ROAS",
  conversions: "Conversões",
};
const OPERATOR_LABEL: Record<Operator, string> = { gt: "maior que", lt: "menor que", eq: "igual a" };

export function AlertasClient({ canManage }: { canManage: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Alert | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/alerts");
      if (res.ok) {
        const json = (await res.json()) as { data: Alert[] };
        setAlerts(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const handleDelete = useCallback(
    async (alert: Alert) => {
      if (!confirm(`Remover o alerta "${alert.name}"?`)) return;
      const res = await fetch(`/api/v1/alerts/${alert.id}`, { method: "DELETE" });
      if (res.ok) void fetchAlerts();
    },
    [fetchAlerts]
  );

  const toggleActive = useCallback(
    async (alert: Alert) => {
      const res = await fetch(`/api/v1/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !alert.active }),
      });
      if (res.ok) void fetchAlerts();
    },
    [fetchAlerts]
  );

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/campanhas" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Alertas de campanhas</h1>
        </div>
        {canManage && (
          <button
            onClick={() => setModal("create")}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Novo alerta
          </button>
        )}
      </div>

      {!canManage && (
        <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-2">
          Você pode visualizar os alertas. Criação e edição são exclusivas do Admin.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <BellRing className="w-8 h-8 opacity-40" />
          <p className="text-sm">Nenhum alerta configurado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {PLATFORM_LABEL[a.platform]} · {METRIC_LABEL[a.metric]} {OPERATOR_LABEL[a.operator]} {a.threshold}
                </p>
              </div>
              <button
                onClick={() => canManage && void toggleActive(a)}
                disabled={!canManage}
                className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                  a.active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"
                } ${canManage ? "cursor-pointer" : "cursor-default"}`}
              >
                {a.active ? "Ativo" : "Inativo"}
              </button>
              {canManage && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      setEditing(a);
                      setModal("edit");
                    }}
                    className="p-1.5 text-muted-foreground hover:bg-accent rounded"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void handleDelete(a)}
                    className="p-1.5 text-muted-foreground hover:bg-accent rounded"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <AlertModal
          alert={modal === "edit" ? editing : null}
          onClose={() => {
            setModal(null);
            setEditing(null);
          }}
          onSaved={() => {
            setModal(null);
            setEditing(null);
            void fetchAlerts();
          }}
        />
      )}
    </div>
  );
}

function AlertModal({
  alert,
  onClose,
  onSaved,
}: {
  alert: Alert | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: alert?.name ?? "",
    platform: (alert?.platform ?? "both") as Platform,
    metric: (alert?.metric ?? "cpm") as Metric,
    operator: (alert?.operator ?? "gt") as Operator,
    threshold: alert?.threshold?.toString() ?? "",
    active: alert?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const url = alert ? `/api/v1/alerts/${alert.id}` : "/api/v1/alerts";
      const method = alert ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          platform: form.platform,
          metric: form.metric,
          operator: form.operator,
          threshold: Number(form.threshold),
          active: form.active,
        }),
      });
      const json = await res.json();
      if (res.ok) onSaved();
      else setError(json.error?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }, [form, alert, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-background border border-border rounded-lg shadow-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{alert ? "Editar alerta" : "Novo alerta"}</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nome do alerta (ex.: CPM acima de R$ 50)"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <div className="grid grid-cols-2 gap-2">
          <Select label="Plataforma" value={form.platform} onChange={(v) => setForm((f) => ({ ...f, platform: v as Platform }))} options={Object.entries(PLATFORM_LABEL)} />
          <Select label="Métrica" value={form.metric} onChange={(v) => setForm((f) => ({ ...f, metric: v as Metric }))} options={Object.entries(METRIC_LABEL)} />
          <Select label="Operador" value={form.operator} onChange={(v) => setForm((f) => ({ ...f, operator: v as Operator }))} options={Object.entries(OPERATOR_LABEL)} />
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Threshold
            <input
              type="number"
              step="any"
              value={form.threshold}
              onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
              className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="rounded border-border"
          />
          Alerta ativo
        </label>

        <div className="flex items-center justify-end gap-2 mt-1">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5">
            Cancelar
          </button>
          <button
            onClick={() => void submit()}
            disabled={saving || !form.name.trim() || form.threshold === ""}
            className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="text-xs text-muted-foreground flex flex-col gap-1">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(([val, lbl]) => (
          <option key={val} value={val}>
            {lbl}
          </option>
        ))}
      </select>
    </label>
  );
}
