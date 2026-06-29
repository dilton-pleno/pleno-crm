"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, X, MessageCircle, Facebook,
  CheckCircle2, AlertCircle, RefreshCw, Radio,
} from "lucide-react";

export interface CanalItem {
  id: string;
  name: string;
  active: boolean;
  whatsapp_instance: string | null;
  meta_page_id: string | null;
  meta_ig_id: string | null;
  has_meta_token: boolean;
  is_default: boolean;
  conversation_count: number;
  channel_count: number;
}

interface FormState {
  name: string;
  whatsapp_instance: string;
  meta_page_id: string;
  meta_ig_id: string;
  meta_access_token: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  whatsapp_instance: "",
  meta_page_id: "",
  meta_ig_id: "",
  meta_access_token: "",
};

type TestMsg = { kind: "ok" | "err"; text: string };

function Field({
  label, value, onChange, placeholder, secret = false,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; secret?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}

function CanalForm({
  form, setForm, onSubmit, onCancel, busy, submitLabel, existing,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
  existing: CanalItem | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Field label="Nome do Canal" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ex.: Canal Vendas" />
      <Field label="Instância do WhatsApp (Evolution)" value={form.whatsapp_instance} onChange={(v) => setForm({ ...form, whatsapp_instance: v })} placeholder="nome-da-instancia" />
      <Field label="Meta Page ID (Messenger)" value={form.meta_page_id} onChange={(v) => setForm({ ...form, meta_page_id: v })} placeholder="ID da página do Facebook" />
      <Field label="Instagram ID" value={form.meta_ig_id} onChange={(v) => setForm({ ...form, meta_ig_id: v })} placeholder="ID da conta do Instagram" />
      <Field
        label="Token Meta da página"
        value={form.meta_access_token}
        onChange={(v) => setForm({ ...form, meta_access_token: v })}
        placeholder={existing?.has_meta_token ? "•••• (mantém se vazio)" : "Token de acesso da página"}
        secret
      />
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onSubmit}
          disabled={busy || !form.name.trim()}
          className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Salvando..." : submitLabel}
        </button>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5">
          Cancelar
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Token é guardado criptografado. App ID/Secret e Verify Token são globais (Integrações → Meta). Campos vazios usam o valor global.
      </p>
    </div>
  );
}

export function CanaisClient({ initialCanais }: { initialCanais: CanalItem[] }) {
  const [canais, setCanais] = useState<CanalItem[]>(initialCanais);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestMsg>>({});

  const startCreate = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setCreating(true);
  }, []);

  const startEdit = useCallback((c: CanalItem) => {
    setForm({
      name: c.name,
      whatsapp_instance: c.whatsapp_instance ?? "",
      meta_page_id: c.meta_page_id ?? "",
      meta_ig_id: c.meta_ig_id ?? "",
      meta_access_token: "",
    });
    setCreating(false);
    setEditingId(c.id);
  }, []);

  const cancel = useCallback(() => {
    setCreating(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }, []);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      const res = await fetch("/api/v1/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setCanais((prev) => [...prev, json.data as CanalItem]);
        cancel();
      } else {
        setError(json.error?.message ?? "Falha ao criar Canal");
      }
    } finally {
      setBusy(false);
    }
  }, [form, cancel]);

  const update = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      // name/instance/page/ig sempre enviados (string vazia limpa); token só se digitado.
      const payload: Record<string, string> = {
        name: form.name,
        whatsapp_instance: form.whatsapp_instance,
        meta_page_id: form.meta_page_id,
        meta_ig_id: form.meta_ig_id,
      };
      if (form.meta_access_token.trim()) payload.meta_access_token = form.meta_access_token;
      const res = await fetch(`/api/v1/inboxes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setCanais((prev) => prev.map((c) => (c.id === id ? { ...c, ...(json.data as CanalItem) } : c)));
        cancel();
      } else {
        setError(json.error?.message ?? "Falha ao salvar Canal");
      }
    } finally {
      setBusy(false);
    }
  }, [form, cancel]);

  const toggleActive = useCallback(async (c: CanalItem) => {
    setCanais((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/v1/inboxes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
  }, []);

  const remove = useCallback(async (c: CanalItem) => {
    if (!confirm(`Excluir o Canal "${c.name}"?`)) return;
    const res = await fetch(`/api/v1/inboxes/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setCanais((prev) => prev.filter((x) => x.id !== c.id));
    } else {
      const json = await res.json();
      setError(json.error?.message ?? "Falha ao excluir Canal");
    }
  }, []);

  const test = useCallback(async (id: string, target: "whatsapp" | "meta") => {
    setTests((prev) => ({ ...prev, [id]: { kind: "ok", text: "Testando…" } }));
    const res = await fetch(`/api/v1/inboxes/${id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    const json = await res.json();
    if (res.ok) {
      const d = json.data;
      const text =
        target === "whatsapp"
          ? d.connected
            ? `WhatsApp conectado${d.number ? ` (${d.number})` : ""}`
            : "WhatsApp desconectado"
          : `Meta OK — página: ${d.pageName}`;
      setTests((prev) => ({ ...prev, [id]: { kind: d.connected ? "ok" : "err", text } }));
    } else {
      setTests((prev) => ({ ...prev, [id]: { kind: "err", text: json.error?.message ?? "Falha no teste" } }));
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/configuracoes" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Canais</h1>
          <p className="text-sm text-muted-foreground">
            Cada Canal agrupa um WhatsApp + Instagram + Facebook próprios, com credenciais por Canal
          </p>
        </div>
        {!creating && !editingId && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Canal
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {creating && (
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 shrink-0">
          <p className="text-sm font-semibold text-foreground">Novo Canal</p>
          <CanalForm form={form} setForm={setForm} onSubmit={() => void create()} onCancel={cancel} busy={busy} submitLabel="Criar Canal" existing={null} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {canais.map((c) => {
          const t = tests[c.id];
          return (
            <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Radio className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    {c.is_default && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Padrão</span>
                    )}
                    {!c.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Inativo</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.conversation_count} conversa(s)</p>
                </div>
                {editingId !== c.id && (
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1 cursor-pointer">
                      <input type="checkbox" checked={c.active} onChange={() => void toggleActive(c)} className="cursor-pointer" />
                      Ativo
                    </label>
                    <button onClick={() => startEdit(c)} className="p-1.5 text-muted-foreground hover:bg-accent rounded" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!c.is_default && (
                      <button onClick={() => void remove(c)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {editingId === c.id ? (
                <div className="border-t border-border pt-3">
                  <CanalForm form={form} setForm={setForm} onSubmit={() => void update(c.id)} onCancel={cancel} busy={busy} submitLabel="Salvar" existing={c} />
                </div>
              ) : (
                <div className="border-t border-border pt-3 flex flex-col gap-2">
                  {/* WhatsApp */}
                  <div className="flex items-center gap-2 text-xs">
                    <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-muted-foreground">WhatsApp:</span>
                    {c.whatsapp_instance ? (
                      <span className="font-medium text-foreground truncate">{c.whatsapp_instance}</span>
                    ) : (
                      <span className="text-muted-foreground italic">global / não definido</span>
                    )}
                    <button
                      onClick={() => void test(c.id, "whatsapp")}
                      className="ml-auto flex items-center gap-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-accent"
                    >
                      <RefreshCw className="w-3 h-3" /> Testar
                    </button>
                  </div>
                  {/* Meta */}
                  <div className="flex items-center gap-2 text-xs">
                    <Facebook className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-muted-foreground">Meta:</span>
                    {c.meta_page_id || c.meta_ig_id ? (
                      <span className="font-medium text-foreground truncate">
                        {c.meta_page_id ? `pág. ${c.meta_page_id}` : ""}{c.meta_page_id && c.meta_ig_id ? " · " : ""}{c.meta_ig_id ? `IG ${c.meta_ig_id}` : ""}
                        {c.has_meta_token ? " · token ✓" : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">global / não definido</span>
                    )}
                    <button
                      onClick={() => void test(c.id, "meta")}
                      className="ml-auto flex items-center gap-1 text-[11px] border border-border rounded px-2 py-1 hover:bg-accent"
                    >
                      <RefreshCw className="w-3 h-3" /> Testar
                    </button>
                  </div>

                  {t && (
                    <div className={`flex items-center gap-1.5 text-[11px] ${t.kind === "ok" ? "text-green-600" : "text-destructive"}`}>
                      {t.kind === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {t.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
