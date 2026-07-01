"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Pencil, MessageCircle, Cloud, Facebook, Radio,
} from "lucide-react";

export interface CanalItem {
  id: string;
  name: string;
  active: boolean;
  is_default: boolean;
  whatsapp_integration: { id: string; name: string; provider: string | null } | null;
  meta_integration: { id: string; name: string } | null;
  conversation_count: number;
  channel_count: number;
}

export interface IntegrationOption {
  id: string;
  name: string;
  type: "whatsapp" | "meta";
  provider: string | null;
  assigned_inbox_id: string | null;
}

interface FormState {
  name: string;
  whatsapp_integration_id: string;
  meta_integration_id: string;
}

const EMPTY_FORM: FormState = { name: "", whatsapp_integration_id: "", meta_integration_id: "" };

// Integrações selecionáveis para um Canal: as livres + a atual do Canal.
function selectableFor(
  integrations: IntegrationOption[],
  type: "whatsapp" | "meta",
  currentId: string | null,
  thisCanalId: string | null
): IntegrationOption[] {
  return integrations.filter(
    (i) =>
      i.type === type &&
      (i.assigned_inbox_id === null ||
        i.id === currentId ||
        (thisCanalId !== null && i.assigned_inbox_id === thisCanalId))
  );
}

function IntegrationSelect({
  label, icon, value, onChange, options, emptyLabel,
}: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; options: IntegrationOption[]; emptyLabel: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground flex items-center gap-1">{icon} {label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}{o.type === "whatsapp" ? ` (${o.provider === "cloud" ? "oficial" : "Evolution"})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CanaisClient({ initialCanais, integrations }: { initialCanais: CanalItem[]; integrations: IntegrationOption[] }) {
  const [canais, setCanais] = useState<CanalItem[]>(initialCanais);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCreate = useCallback(() => { setForm({ ...EMPTY_FORM }); setEditingId(null); setCreating(true); }, []);
  const startEdit = useCallback((c: CanalItem) => {
    setForm({
      name: c.name,
      whatsapp_integration_id: c.whatsapp_integration?.id ?? "",
      meta_integration_id: c.meta_integration?.id ?? "",
    });
    setCreating(false);
    setEditingId(c.id);
  }, []);
  const cancel = useCallback(() => { setCreating(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setError(null); }, []);

  const create = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/v1/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          whatsapp_integration_id: form.whatsapp_integration_id || null,
          meta_integration_id: form.meta_integration_id || null,
        }),
      });
      const json = await res.json();
      if (res.ok) { setCanais((p) => [...p, json.data as CanalItem]); cancel(); }
      else setError(json.error?.message ?? "Falha ao criar Canal");
    } finally { setBusy(false); }
  }, [form, cancel]);

  const update = useCallback(async (id: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/v1/inboxes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          whatsapp_integration_id: form.whatsapp_integration_id || null,
          meta_integration_id: form.meta_integration_id || null,
        }),
      });
      const json = await res.json();
      if (res.ok) { setCanais((p) => p.map((c) => (c.id === id ? { ...c, ...(json.data as CanalItem) } : c))); cancel(); }
      else setError(json.error?.message ?? "Falha ao salvar Canal");
    } finally { setBusy(false); }
  }, [form, cancel]);

  const toggleActive = useCallback(async (c: CanalItem) => {
    setCanais((p) => p.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    await fetch(`/api/v1/inboxes/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
  }, []);

  const remove = useCallback(async (c: CanalItem) => {
    if (!confirm(`Excluir o Canal "${c.name}"?`)) return;
    const res = await fetch(`/api/v1/inboxes/${c.id}`, { method: "DELETE" });
    if (res.ok) setCanais((p) => p.filter((x) => x.id !== c.id));
    else { const json = await res.json(); setError(json.error?.message ?? "Falha ao excluir Canal"); }
  }, []);

  const renderForm = (canalId: string | null) => (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Nome do Canal</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Atendimento, Comercial"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
      </label>
      <IntegrationSelect
        label="Integração WhatsApp" icon={<MessageCircle className="w-3 h-3 text-green-600" />}
        value={form.whatsapp_integration_id} onChange={(v) => setForm({ ...form, whatsapp_integration_id: v })}
        options={selectableFor(integrations, "whatsapp", form.whatsapp_integration_id || null, canalId)}
        emptyLabel="— nenhuma —"
      />
      <IntegrationSelect
        label="Integração Meta (Instagram/Messenger)" icon={<Facebook className="w-3 h-3 text-blue-600" />}
        value={form.meta_integration_id} onChange={(v) => setForm({ ...form, meta_integration_id: v })}
        options={selectableFor(integrations, "meta", form.meta_integration_id || null, canalId)}
        emptyLabel="— nenhuma —"
      />
      <div className="flex items-center gap-2 mt-1">
        <button onClick={() => (canalId ? void update(canalId) : void create())} disabled={busy || !form.name.trim()}
          className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40">
          {busy ? "Salvando…" : canalId ? "Salvar" : "Criar Canal"}
        </button>
        <button onClick={cancel} className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5">Cancelar</button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        As integrações são criadas em <Link href="/configuracoes/integracoes" className="underline">Integrações</Link>. Cada uma só pode ser usada em um Canal.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/configuracoes" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Canais</h1>
          <p className="text-sm text-muted-foreground">Cada Canal usa uma integração de WhatsApp e uma de Meta (exclusivas por Canal)</p>
        </div>
        {!creating && !editingId && (
          <button onClick={startCreate} className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90">
            <Plus className="w-3.5 h-3.5" /> Novo Canal
          </button>
        )}
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{error}</div>}

      {creating && (
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 shrink-0">
          <p className="text-sm font-semibold text-foreground">Novo Canal</p>
          {renderForm(null)}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {canais.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Radio className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                  {c.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Padrão</span>}
                  {!c.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Inativo</span>}
                </div>
                <p className="text-xs text-muted-foreground">{c.conversation_count} conversa(s)</p>
              </div>
              {editingId !== c.id && (
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1 cursor-pointer">
                    <input type="checkbox" checked={c.active} onChange={() => void toggleActive(c)} className="cursor-pointer" /> Ativo
                  </label>
                  <button onClick={() => startEdit(c)} className="p-1.5 text-muted-foreground hover:bg-accent rounded" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  {!c.is_default && (
                    <button onClick={() => void remove(c)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              )}
            </div>

            {editingId === c.id ? (
              <div className="border-t border-border pt-3">{renderForm(c.id)}</div>
            ) : (
              <div className="border-t border-border pt-3 flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {c.whatsapp_integration?.provider === "cloud" ? <Cloud className="w-4 h-4 text-blue-600" /> : <MessageCircle className="w-4 h-4 text-green-600" />}
                  <span className="text-muted-foreground">WhatsApp:</span>
                  {c.whatsapp_integration ? (
                    <span className="font-medium text-foreground truncate">{c.whatsapp_integration.name} <span className="text-muted-foreground">({c.whatsapp_integration.provider === "cloud" ? "oficial" : "Evolution"})</span></span>
                  ) : (
                    <span className="text-muted-foreground italic">nenhuma integração</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Facebook className="w-4 h-4 text-blue-600" />
                  <span className="text-muted-foreground">Meta:</span>
                  {c.meta_integration ? (
                    <span className="font-medium text-foreground truncate">{c.meta_integration.name}</span>
                  ) : (
                    <span className="text-muted-foreground italic">nenhuma integração</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
