"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, MessageCircle, Cloud, Facebook, CheckCircle2, AlertCircle,
  RefreshCw, QrCode, Unplug, History, Trash2, Pencil, Radio,
} from "lucide-react";

type IntegrationType = "whatsapp" | "meta";
type Provider = "evolution" | "cloud";

interface IntegrationItem {
  id: string;
  type: IntegrationType;
  name: string;
  provider: Provider | null;
  active: boolean;
  wa_instance: string | null;
  wa_phone_number_id: string | null;
  waba_id: string | null;
  meta_page_id: string | null;
  meta_ig_id: string | null;
  has_token: boolean;
  assigned_inbox: { id: string; name: string } | null;
}

interface FormState {
  type: IntegrationType;
  provider: Provider;
  name: string;
  wa_instance: string;
  wa_phone_number_id: string;
  waba_id: string;
  meta_page_id: string;
  meta_ig_id: string;
  access_token: string;
  verify_token: string;
}

const EMPTY_FORM: FormState = {
  type: "whatsapp", provider: "evolution", name: "",
  wa_instance: "", wa_phone_number_id: "", waba_id: "",
  meta_page_id: "", meta_ig_id: "", access_token: "", verify_token: "",
};

const INPUT = "text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring w-full";

type Msg = { kind: "ok" | "err"; text: string };

function Field({ label, value, onChange, placeholder, secret = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; secret?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input type={secret ? "password" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={INPUT} />
    </label>
  );
}

export function IntegrationsManager() {
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tests, setTests] = useState<Record<string, Msg>>({});
  const [qrcode, setQrcode] = useState<string | null>(null);

  // Wizard: escolha de tipo → provedor (WhatsApp) → formulário.
  const [step, setStep] = useState<null | "type" | "provider" | "form">(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/integrations");
    const json = await res.json();
    if (res.ok) setItems(json.data as IntegrationItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startCreate = () => { setForm({ ...EMPTY_FORM }); setEditingId(null); setStep("type"); };
  const cancel = () => { setStep(null); setEditingId(null); setForm({ ...EMPTY_FORM }); setError(null); };

  const startEdit = (i: IntegrationItem) => {
    setForm({
      type: i.type, provider: (i.provider ?? "evolution") as Provider, name: i.name,
      wa_instance: i.wa_instance ?? "", wa_phone_number_id: i.wa_phone_number_id ?? "", waba_id: i.waba_id ?? "",
      meta_page_id: i.meta_page_id ?? "", meta_ig_id: i.meta_ig_id ?? "", access_token: "", verify_token: "",
    });
    setEditingId(i.id);
    setStep("form");
  };

  const submit = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const payload: Record<string, string | boolean> = { type: form.type, name: form.name };
      if (form.type === "whatsapp") {
        payload.provider = form.provider;
        if (form.provider === "evolution") payload.wa_instance = form.wa_instance;
        else {
          payload.wa_phone_number_id = form.wa_phone_number_id;
          payload.waba_id = form.waba_id;
          if (form.verify_token.trim()) payload.verify_token = form.verify_token;
        }
      } else {
        payload.meta_page_id = form.meta_page_id;
        payload.meta_ig_id = form.meta_ig_id;
      }
      if (form.access_token.trim()) payload.access_token = form.access_token;

      const url = editingId ? `/api/v1/integrations/${editingId}` : "/api/v1/integrations";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (res.ok) { await load(); cancel(); }
      else setError(json.error?.message ?? "Falha ao salvar integração");
    } finally { setBusy(false); }
  }, [form, editingId, load]);

  const remove = useCallback(async (i: IntegrationItem) => {
    if (!confirm(`Excluir a integração "${i.name}"?`)) return;
    const res = await fetch(`/api/v1/integrations/${i.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== i.id));
    else { const j = await res.json(); setError(j.error?.message ?? "Falha ao excluir"); }
  }, []);

  const test = useCallback(async (i: IntegrationItem) => {
    setTests((p) => ({ ...p, [i.id]: { kind: "ok", text: "Testando…" } }));
    const res = await fetch(`/api/v1/integrations/${i.id}/test`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      const d = json.data;
      let text: string;
      if (d.provider === "cloud") text = `Cloud OK — ${d.verifiedName ?? "número"}${d.number ? ` (${d.number})` : ""}${d.qualityRating ? ` · ${d.qualityRating}` : ""}`;
      else if (d.provider === "evolution") text = d.connected ? `Conectado${d.number ? ` (${d.number})` : ""}` : "Desconectado";
      else text = `Meta OK — ${d.pageName}`;
      setTests((p) => ({ ...p, [i.id]: { kind: d.connected ? "ok" : "err", text } }));
    } else setTests((p) => ({ ...p, [i.id]: { kind: "err", text: json.error?.message ?? "Falha no teste" } }));
  }, []);

  const qr = useCallback(async (i: IntegrationItem, force: boolean) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/v1/integrations/${i.id}/qrcode${force ? "?force=true" : ""}`);
      const json = await res.json();
      if (res.ok) setQrcode(json.data.qrcode as string);
      else setError(json.error?.message ?? "Falha ao gerar QR Code");
    } finally { setBusy(false); }
  }, []);

  const disconnect = useCallback(async (i: IntegrationItem) => {
    if (!confirm(`Desconectar a sessão da integração "${i.name}"? Será preciso novo QR para reconectar.`)) return;
    const res = await fetch(`/api/v1/integrations/${i.id}/disconnect`, { method: "POST" });
    const json = await res.json();
    setTests((p) => ({ ...p, [i.id]: res.ok ? { kind: "ok", text: "Desconectado — gere novo QR" } : { kind: "err", text: json.error?.message ?? "Falha" } }));
  }, []);

  const importHistory = useCallback(async (i: IntegrationItem) => {
    if (!confirm("Importar o histórico dos últimos 90 dias desta integração? Roda em segundo plano.")) return;
    const res = await fetch(`/api/v1/integrations/${i.id}/import-history`, { method: "POST" });
    const json = await res.json();
    setTests((p) => ({ ...p, [i.id]: res.ok ? { kind: "ok", text: "Importação iniciada" } : { kind: "err", text: json.error?.message ?? "Falha" } }));
  }, []);

  const whats = items.filter((i) => i.type === "whatsapp");
  const metas = items.filter((i) => i.type === "meta");

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Radio className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Integrações de mensageria</p>
          <p className="text-xs text-muted-foreground">Crie contas de WhatsApp e Meta e atribua a Canais (uma por Canal)</p>
        </div>
        {step === null && (
          <button onClick={startCreate} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Nova integração
          </button>
        )}
      </div>

      {error && <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{error}</div>}

      {/* Wizard */}
      {step === "type" && (
        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Qual integração deseja criar?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setForm({ ...EMPTY_FORM, type: "whatsapp" }); setStep("provider"); }} className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-3 hover:bg-accent">
              <MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp
            </button>
            <button onClick={() => { setForm({ ...EMPTY_FORM, type: "meta" }); setStep("form"); }} className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-3 hover:bg-accent">
              <Facebook className="w-4 h-4 text-blue-600" /> Instagram / Messenger
            </button>
          </div>
          <button onClick={cancel} className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5 self-start">Cancelar</button>
        </div>
      )}

      {step === "provider" && (
        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">Qual provedor do WhatsApp?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setForm((f) => ({ ...f, provider: "evolution" })); setStep("form"); }} className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-3 hover:bg-accent">
              <MessageCircle className="w-4 h-4 text-green-600" /> API não oficial (Evolution)
            </button>
            <button onClick={() => { setForm((f) => ({ ...f, provider: "cloud" })); setStep("form"); }} className="flex items-center gap-2 text-sm border border-border rounded-md px-3 py-3 hover:bg-accent">
              <Cloud className="w-4 h-4 text-blue-600" /> API oficial (Meta Cloud)
            </button>
          </div>
          <button onClick={() => setStep("type")} className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5 self-start">Voltar</button>
        </div>
      )}

      {step === "form" && (
        <div className="border-t border-border pt-4 flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">
            {editingId ? "Editar integração" : "Nova integração"} — {form.type === "meta" ? "Meta (Instagram/Messenger)" : form.provider === "cloud" ? "WhatsApp Cloud (oficial)" : "WhatsApp Evolution"}
          </p>
          <Field label="Nome da integração" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ex.: Atendimento, Comercial" />

          {form.type === "whatsapp" && form.provider === "evolution" && (
            <Field label="Instância do WhatsApp (Evolution)" value={form.wa_instance} onChange={(v) => setForm({ ...form, wa_instance: v })} placeholder="nome-da-instancia" />
          )}
          {form.type === "whatsapp" && form.provider === "cloud" && (
            <>
              <Field label="Phone Number ID (Cloud)" value={form.wa_phone_number_id} onChange={(v) => setForm({ ...form, wa_phone_number_id: v })} placeholder="ID do número na Meta" />
              <Field label="WABA ID" value={form.waba_id} onChange={(v) => setForm({ ...form, waba_id: v })} placeholder="ID da conta WhatsApp Business" />
              <Field label="Token de acesso (Cloud)" value={form.access_token} onChange={(v) => setForm({ ...form, access_token: v })} placeholder={editingId ? "•••• (mantém se vazio)" : "Token do sistema"} secret />
              <Field label="Verify Token do webhook" value={form.verify_token} onChange={(v) => setForm({ ...form, verify_token: v })} placeholder="opcional; há global" secret />
            </>
          )}
          {form.type === "meta" && (
            <>
              <Field label="Meta Page ID (Messenger)" value={form.meta_page_id} onChange={(v) => setForm({ ...form, meta_page_id: v })} placeholder="ID da página do Facebook" />
              <Field label="Instagram ID" value={form.meta_ig_id} onChange={(v) => setForm({ ...form, meta_ig_id: v })} placeholder="ID da conta do Instagram" />
              <Field label="Token da página (acesso)" value={form.access_token} onChange={(v) => setForm({ ...form, access_token: v })} placeholder={editingId ? "•••• (mantém se vazio)" : "Token de acesso da página"} secret />
            </>
          )}

          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => void submit()} disabled={busy || !form.name.trim()} className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40">
              {busy ? "Salvando…" : editingId ? "Salvar" : "Criar integração"}
            </button>
            <button onClick={cancel} className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5">Cancelar</button>
          </div>
          <p className="text-[10px] text-muted-foreground">Segredos guardados criptografados. App ID/Secret e Verify globais em Meta (abaixo). Vazios usam o valor global.</p>
        </div>
      )}

      {/* Lista */}
      {step === null && (
        <div className="border-t border-border pt-4 flex flex-col gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma integração ainda. Clique em “Nova integração”.</p>
          ) : (
            <>
              {whats.length > 0 && <IntegrationGroup title="WhatsApp" items={whats} tests={tests} busy={busy} onEdit={startEdit} onRemove={remove} onTest={test} onQr={qr} onDisconnect={disconnect} onImport={importHistory} />}
              {metas.length > 0 && <IntegrationGroup title="Instagram / Messenger" items={metas} tests={tests} busy={busy} onEdit={startEdit} onRemove={remove} onTest={test} onQr={qr} onDisconnect={disconnect} onImport={importHistory} />}
            </>
          )}
        </div>
      )}

      {qrcode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQrcode(null)}>
          <div className="bg-card rounded-lg p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Escanear QR Code</h2>
              <button onClick={() => setQrcode(null)} className="p-1 text-muted-foreground hover:bg-accent rounded"><X className="w-4 h-4" /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrcode} alt="QR Code do WhatsApp" className="w-64 h-64" />
            <p className="text-[11px] text-muted-foreground max-w-64">Abra o WhatsApp no celular → Aparelhos conectados → escaneie.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationGroup({ title, items, tests, busy, onEdit, onRemove, onTest, onQr, onDisconnect, onImport }: {
  title: string;
  items: IntegrationItem[];
  tests: Record<string, Msg>;
  busy: boolean;
  onEdit: (i: IntegrationItem) => void;
  onRemove: (i: IntegrationItem) => void;
  onTest: (i: IntegrationItem) => void;
  onQr: (i: IntegrationItem, force: boolean) => void;
  onDisconnect: (i: IntegrationItem) => void;
  onImport: (i: IntegrationItem) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.map((i) => {
        const t = tests[i.id];
        const isEvolution = i.type === "whatsapp" && i.provider === "evolution";
        const isCloud = i.type === "whatsapp" && i.provider === "cloud";
        return (
          <div key={i.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {isCloud ? <Cloud className="w-4 h-4 text-blue-600" /> : i.type === "meta" ? <Facebook className="w-4 h-4 text-blue-600" /> : <MessageCircle className="w-4 h-4 text-green-600" />}
              <span className="text-sm font-medium text-foreground truncate">{i.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {i.type === "meta" ? "Meta" : i.provider === "cloud" ? "oficial" : "Evolution"}
              </span>
              {i.assigned_inbox ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Canal: {i.assigned_inbox.name}</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">não atribuída</span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => onEdit(i)} className="p-1.5 text-muted-foreground hover:bg-accent rounded" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => onRemove(i)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isEvolution && <>instância <span className="text-foreground">{i.wa_instance ?? "—"}</span></>}
              {isCloud && <>nº <span className="text-foreground">{i.wa_phone_number_id ?? "—"}</span>{i.has_token ? " · token ✓" : ""}</>}
              {i.type === "meta" && <>página <span className="text-foreground">{i.meta_page_id ?? "—"}</span>{i.meta_ig_id ? ` · IG ${i.meta_ig_id}` : ""}{i.has_token ? " · token ✓" : ""}</>}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => onTest(i)} className="flex items-center gap-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-accent"><RefreshCw className="w-3 h-3" /> Testar</button>
              {isEvolution && (
                <>
                  <button onClick={() => onQr(i, true)} disabled={busy} className="flex items-center gap-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-accent disabled:opacity-50"><QrCode className="w-3 h-3" /> QR / Reconectar</button>
                  <button onClick={() => onDisconnect(i)} className="flex items-center gap-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-accent"><Unplug className="w-3 h-3" /> Desconectar</button>
                  <button onClick={() => onImport(i)} className="flex items-center gap-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-accent"><History className="w-3 h-3" /> Importar histórico</button>
                </>
              )}
            </div>
            {t && (
              <div className={`flex items-center gap-1.5 text-[11px] ${t.kind === "ok" ? "text-green-600" : "text-destructive"}`}>
                {t.kind === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {t.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
