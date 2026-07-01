"use client";

import { useState, useEffect, useCallback } from "react";
import { Megaphone, CheckCircle2, AlertCircle, Plug, RefreshCw, DownloadCloud } from "lucide-react";

interface MetaAdsStatus {
  accessToken: boolean; // tem token (próprio ou herdado da mensageria)
  ownToken: boolean; // tem token próprio de anúncios
  adAccountId: string | null;
}

const EMPTY_FORM = { access_token: "", ad_account_id: "" };

export function MetaAdsCard() {
  const [status, setStatus] = useState<MetaAdsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/integrations/meta-ads/config");
      if (res.ok) setStatus((await res.json()).data as MetaAdsStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const configured = Boolean(status?.accessToken && status?.adAccountId);

  const save = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      const res = await fetch("/api/v1/integrations/meta-ads/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus(json.data as MetaAdsStatus);
        setEditing(false);
        setForm({ ...EMPTY_FORM });
        setMessage({ kind: "ok", text: "Configuração salva." });
      } else {
        setMessage({ kind: "err", text: json.error?.message ?? "Falha ao salvar" });
      }
    } finally {
      setWorking(false);
    }
  }, [form]);

  const test = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/meta-ads/test", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Conexão OK — conta: ${json.data.accountName}` }
          : { kind: "err", text: json.error?.message ?? "Falha na conexão" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "meta", days: 30 }),
      });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Sincronizado — ${json.data.synced} registro(s) dos últimos 30 dias.` }
          : { kind: "err", text: json.error?.message ?? "Falha ao sincronizar" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Megaphone className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Meta — Anúncios</p>
          <p className="text-xs text-muted-foreground">Métricas de campanhas (Marketing API)</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        {loading ? (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        ) : configured ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Configurado</span>
            {status?.adAccountId && <span className="text-xs text-muted-foreground">· conta {status.adAccountId}</span>}
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Não configurado</span>
          </>
        )}
      </div>

      {message && (
        <div
          className={`text-xs rounded-md px-3 py-2 border ${
            message.kind === "ok"
              ? "bg-green-500/10 border-green-500/30 text-green-600"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Ad Account ID</span>
            <input
              value={form.ad_account_id}
              onChange={(e) => setForm((f) => ({ ...f, ad_account_id: e.target.value }))}
              placeholder={status?.adAccountId ?? "ID da conta de anúncios (sem 'act_')"}
              className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Access Token (opcional)</span>
            <input
              type="password"
              value={form.access_token}
              onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
              placeholder={status?.ownToken ? "•••• (mantém se vazio)" : "Vazio = usa o token da Mensageria"}
              className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => void save()}
              disabled={working}
              className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
            >
              {working ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setForm({ ...EMPTY_FORM });
              }}
              className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Deixe o token vazio para reaproveitar o da Mensageria (se ele tiver permissão de anúncios).
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90"
          >
            <Plug className="w-3.5 h-3.5" />
            {configured ? "Atualizar" : "Configurar"}
          </button>
          {configured && (
            <>
              <button
                onClick={() => void test()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Testar conexão
              </button>
              <button
                onClick={() => void sync()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                <DownloadCloud className="w-3.5 h-3.5" /> Sincronizar agora
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
