"use client";

import { useState, useEffect, useCallback } from "react";
import { Facebook, CheckCircle2, AlertCircle, Plug, RefreshCw } from "lucide-react";

interface MetaStatus {
  appId: boolean;
  appSecret: boolean;
  accessToken: boolean;
  pageId: string | null;
  adAccountId: string | null;
  verifyToken: boolean;
}

const EMPTY_FORM = {
  app_id: "",
  app_secret: "",
  access_token: "",
  page_id: "",
  ad_account_id: "",
  verify_token: "",
};

export function MetaCard() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/integrations/meta/config");
      if (res.ok) setStatus((await res.json()).data as MetaStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const configured = Boolean(status?.accessToken && status?.pageId);

  const save = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      // Envia só os campos preenchidos (segredos em branco mantêm o atual).
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      const res = await fetch("/api/v1/integrations/meta/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus(json.data as MetaStatus);
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
      const res = await fetch("/api/v1/integrations/meta/test", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Conexão OK — página: ${json.data.pageName}` }
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
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Facebook className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Meta (Facebook / Instagram / Messenger)</p>
          <p className="text-xs text-muted-foreground">Mensageria (Direct/Messenger) e anúncios</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        {loading ? (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        ) : configured ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Configurado</span>
            {status?.pageId && <span className="text-xs text-muted-foreground">· página {status.pageId}</span>}
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
          {field("app_id", "App ID", status?.appId ? "•••• (preenchido)" : "App ID")}
          {field("app_secret", "App Secret", status?.appSecret ? "•••• (mantém se vazio)" : "App Secret", true)}
          {field("access_token", "Access Token", status?.accessToken ? "•••• (mantém se vazio)" : "Token de acesso", true)}
          {field("page_id", "Page ID", status?.pageId ?? "Page ID")}
          {field("ad_account_id", "Ad Account ID", status?.adAccountId ?? "ID da conta de anúncios")}
          {field("verify_token", "Verify Token (webhook)", status?.verifyToken ? "•••• (mantém se vazio)" : "Token de verificação", true)}
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
            Segredos são guardados criptografados. Deixe um campo de segredo vazio para manter o valor atual.
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
