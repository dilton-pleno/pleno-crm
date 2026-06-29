"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, CheckCircle2, AlertCircle, Plug, RefreshCw } from "lucide-react";

interface GoogleStatus {
  clientId: boolean;
  clientSecret: boolean;
  refreshToken: boolean;
  adsDeveloperToken: boolean;
  adsCustomerId: string | null;
  ga4PropertyId: string | null;
  merchantId: string | null;
}

const EMPTY_FORM = {
  client_id: "",
  client_secret: "",
  refresh_token: "",
  ads_developer_token: "",
  ads_customer_id: "",
  ga4_property_id: "",
  merchant_id: "",
};

export function GoogleCard() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/integrations/google/config");
      if (res.ok) setStatus((await res.json()).data as GoogleStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const configured = Boolean(status?.clientId && status?.clientSecret && status?.refreshToken);

  const save = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      const res = await fetch("/api/v1/integrations/google/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus(json.data as GoogleStatus);
        setEditing(false);
        setForm({ ...EMPTY_FORM });
        setMessage({ kind: "ok", text: "Credenciais salvas." });
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
      const res = await fetch("/api/v1/integrations/google/test", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: "Conexão OAuth OK." }
          : { kind: "err", text: json.error?.message ?? "Falha na conexão" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const field = (key: keyof typeof form, label: string, placeholder: string, secret = false) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type={secret ? "password" : "text"}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Google (Ads / Analytics)</p>
          <p className="text-xs text-muted-foreground">Métricas de campanhas, GA4 e Merchant Center</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        {loading ? (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        ) : configured ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Configurado</span>
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
          {field("client_id", "Client ID", status?.clientId ? "•••• (preenchido)" : "OAuth Client ID")}
          {field("client_secret", "Client Secret", status?.clientSecret ? "•••• (mantém se vazio)" : "OAuth Client Secret", true)}
          {field("refresh_token", "Refresh Token", status?.refreshToken ? "•••• (mantém se vazio)" : "Refresh token OAuth", true)}
          {field("ads_developer_token", "Ads Developer Token", status?.adsDeveloperToken ? "•••• (mantém se vazio)" : "Developer token", true)}
          {field("ads_customer_id", "Ads Customer ID", status?.adsCustomerId ?? "ID da conta Google Ads")}
          {field("ga4_property_id", "GA4 Property ID", status?.ga4PropertyId ?? "ID da propriedade GA4")}
          {field("merchant_id", "Merchant Center ID", status?.merchantId ?? "ID do Merchant Center")}
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
            Segredos cifrados. O refresh token OAuth é gerado uma vez (pela Pleno) e colado aqui.
            Deixe um segredo em branco para manter o atual.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90"
          >
            <Plug className="w-3.5 h-3.5" />
            {configured ? "Atualizar credenciais" : "Configurar"}
          </button>
          {configured && (
            <button
              onClick={() => void test()}
              disabled={working}
              className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Testar conexão
            </button>
          )}
        </div>
      )}
    </div>
  );
}
