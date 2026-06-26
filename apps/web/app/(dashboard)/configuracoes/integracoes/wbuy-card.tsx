"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, CheckCircle2, AlertCircle, Plug, Trash2, RefreshCw, Users } from "lucide-react";

interface ImportStatus {
  status: "running" | "done" | "error";
  imported?: number;
  start?: string;
  finishedAt?: string;
}

interface WbuyStatus {
  configured: boolean;
  apiUserMasked: string | null;
  active: boolean;
  lastImport: ImportStatus | null;
}

interface Webhook {
  id: string;
  url: string;
  type: string;
}

export function WbuyCard() {
  const [status, setStatus] = useState<WbuyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ api_user: "", api_secret: "" });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/config");
      if (res.ok) {
        const json = (await res.json()) as { data: WbuyStatus };
        setStatus(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const saveCreds = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus(json.data as WbuyStatus);
        setEditing(false);
        setForm({ api_user: "", api_secret: "" });
        setMessage({ kind: "ok", text: "Credenciais salvas." });
      } else {
        setMessage({ kind: "err", text: json.error?.message ?? "Falha ao salvar" });
      }
    } finally {
      setWorking(false);
    }
  }, [form]);

  const testConnection = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/test", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: "Conexão com a Wbuy OK." }
          : { kind: "err", text: json.error?.message ?? "Falha na conexão" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const registerWebhooks = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/webhooks", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        const ok = (json.data.registered as Array<{ ok: boolean }>).filter((r) => r.ok).length;
        const total = (json.data.registered as Array<{ ok: boolean }>).length;
        setMessage({ kind: ok > 0 ? "ok" : "err", text: `Webhooks registrados: ${ok}/${total}` });
        await loadWebhooks();
      } else {
        setMessage({ kind: "err", text: json.error?.message ?? "Falha ao registrar" });
      }
    } finally {
      setWorking(false);
    }
  }, []);

  const importHistory = useCallback(async () => {
    if (!confirm("Importar TODO o histórico de pedidos desde 01/03/2025? Roda em segundo plano.")) {
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/import-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: "2025-03-01" }),
      });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: "Importação iniciada em segundo plano. Acompanhe abaixo (atualize a página)." }
          : { kind: "err", text: json.error?.message ?? "Falha ao iniciar importação" }
      );
      await fetchStatus();
    } finally {
      setWorking(false);
    }
  }, [fetchStatus]);

  const syncOrders = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/sync-orders", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Pedidos sincronizados: ${json.data.synced}/${json.data.fetched}` }
          : { kind: "err", text: json.error?.message ?? "Falha ao sincronizar" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const syncProducts = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/sync-products", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Produtos ativos sincronizados: ${json.data.synced}` }
          : { kind: "err", text: json.error?.message ?? "Falha ao sincronizar produtos" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const syncReviews = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/sync-reviews", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Avaliações: ${json.data.synced} sincronizadas, ${json.data.created} novas` }
          : { kind: "err", text: json.error?.message ?? "Falha ao sincronizar avaliações" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const syncNewsletter = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/sync-newsletter", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Newsletter: ${json.data.synced} inscritos sincronizados` }
          : { kind: "err", text: json.error?.message ?? "Falha ao sincronizar newsletter" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const syncCustomers = useCallback(async () => {
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/wbuy/sync-customers", { method: "POST" });
      const json = await res.json();
      setMessage(
        res.ok
          ? { kind: "ok", text: `Clientes: ${json.data.enriched} contatos enriquecidos (${json.data.scanned} verificados)` }
          : { kind: "err", text: json.error?.message ?? "Falha ao sincronizar clientes" }
      );
    } finally {
      setWorking(false);
    }
  }, []);

  const loadWebhooks = useCallback(async () => {
    const res = await fetch("/api/v1/integrations/wbuy/webhooks");
    if (res.ok) {
      const json = (await res.json()) as { data: Webhook[] };
      setWebhooks(json.data);
    }
  }, []);

  const removeWebhook = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/integrations/wbuy/webhooks/${id}`, { method: "DELETE" });
      if (res.ok) setWebhooks((w) => (w ? w.filter((x) => x.id !== id) : w));
    },
    []
  );

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Wbuy (E-commerce)</p>
          <p className="text-xs text-muted-foreground">
            Credenciais da API e webhooks de pedidos
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        {loading ? (
          <span className="text-sm text-muted-foreground">Carregando...</span>
        ) : status?.configured ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Configurado</span>
            {status.apiUserMasked && (
              <span className="text-xs text-muted-foreground">· {status.apiUserMasked}</span>
            )}
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
          <input
            value={form.api_user}
            onChange={(e) => setForm((f) => ({ ...f, api_user: e.target.value }))}
            placeholder="Usuário da API"
            className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="password"
            value={form.api_secret}
            onChange={(e) => setForm((f) => ({ ...f, api_secret: e.target.value }))}
            placeholder="Senha da API"
            className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => void saveCreds()}
              disabled={working || !form.api_user || !form.api_secret}
              className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
            >
              {working ? "Salvando..." : "Salvar credenciais"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            A senha é guardada criptografada. Painel Wbuy: Plataforma → API e webhooks.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90"
          >
            <Plug className="w-3.5 h-3.5" />
            {status?.configured ? "Atualizar credenciais" : "Configurar"}
          </button>
          {status?.configured && (
            <>
              <button
                onClick={() => void testConnection()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Testar conexão
              </button>
              <button
                onClick={() => void registerWebhooks()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                Registrar webhooks
              </button>
              <button
                onClick={() => void syncOrders()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                <ShoppingCart className="w-3.5 h-3.5" /> Sincronizar pedidos
              </button>
              <button
                onClick={() => void syncCustomers()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                <Users className="w-3.5 h-3.5" /> Sincronizar clientes
              </button>
              <button
                onClick={() => void importHistory()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                Importar histórico
              </button>
              <button
                onClick={() => void syncProducts()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                Sincronizar produtos
              </button>
              <button
                onClick={() => void syncReviews()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                Sincronizar avaliações
              </button>
              <button
                onClick={() => void syncNewsletter()}
                disabled={working}
                className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent disabled:opacity-50"
              >
                Sincronizar newsletter
              </button>
              <button
                onClick={() => void loadWebhooks()}
                className="text-xs text-muted-foreground hover:underline px-1"
              >
                Ver webhooks
              </button>
            </>
          )}
        </div>
      )}

      {status?.lastImport && (
        <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
          Importação de histórico:{" "}
          {status.lastImport.status === "running" && "em andamento…"}
          {status.lastImport.status === "done" &&
            `concluída — ${status.lastImport.imported ?? 0} pedidos desde ${status.lastImport.start ?? ""}`}
          {status.lastImport.status === "error" &&
            `falhou (importados ${status.lastImport.imported ?? 0})`}
        </div>
      )}

      {webhooks && (
        <div className="border-t border-border pt-3 flex flex-col gap-1.5">
          <p className="text-xs font-medium text-foreground">Webhooks registrados ({webhooks.length})</p>
          {webhooks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum webhook na Wbuy.</p>
          ) : (
            webhooks.map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-xs">
                <span className="text-foreground font-medium w-28 truncate">{w.type}</span>
                <span className="text-muted-foreground truncate flex-1">{w.url}</span>
                <button
                  onClick={() => void removeWebhook(w.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
