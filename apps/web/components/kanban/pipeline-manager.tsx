"use client";

import { useState } from "react";
import { X, Star, Plus, Trash2, Check } from "lucide-react";

export interface PipelineSummary {
  id: string;
  name: string;
  is_default: boolean;
}

/**
 * Modal de gerência de pipelines (criar, renomear, definir padrão, excluir).
 * Compartilhado entre o Kanban e a tela de Configurações → Pipeline.
 * `onChanged` recebe opcionalmente o id que deve passar a ser o selecionado.
 */
export function PipelineManager({
  pipelines,
  currentPipelineId,
  onClose,
  onChanged,
}: {
  pipelines: PipelineSummary[];
  currentPipelineId: string;
  onClose: () => void;
  onChanged: (nextSelected?: string) => void | Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (res.ok) {
        setNewName("");
        await onChanged(json.data.id as string);
      } else {
        setError(json.error?.message ?? "Falha ao criar pipeline");
      }
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch(`/api/v1/pipelines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await onChanged();
    else setError((await res.json()).error?.message ?? "Falha ao atualizar");
  };

  const remove = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/v1/pipelines/${id}`, { method: "DELETE" });
    if (res.ok) {
      const next = id === currentPipelineId ? pipelines.find((p) => p.id !== id)?.id : undefined;
      await onChanged(next);
    } else {
      setError((await res.json()).error?.message ?? "Falha ao excluir");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-xl flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Gerenciar pipelines</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {pipelines.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border border-border rounded-md px-2.5 py-2">
              <button
                onClick={() => !p.is_default && void patch(p.id, { is_default: true })}
                title={p.is_default ? "Pipeline padrão" : "Definir como padrão"}
                className={p.is_default ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500"}
              >
                <Star className="w-4 h-4" fill={p.is_default ? "currentColor" : "none"} />
              </button>
              {editingId === p.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    className="flex-1 text-sm bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={async () => {
                      if (editingName.trim()) await patch(p.id, { name: editingName.trim() });
                      setEditingId(null);
                    }}
                    className="p-1 text-green-600 hover:bg-accent rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-accent rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(p.id);
                    setEditingName(p.name);
                  }}
                  className="flex-1 text-left text-sm font-medium text-foreground hover:underline"
                >
                  {p.name}
                </button>
              )}
              {!p.is_default && (
                <button
                  onClick={() => void remove(p.id)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  title="Excluir pipeline"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            placeholder="Nome do novo pipeline…"
            className="flex-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => void create()}
            disabled={!newName.trim() || busy}
            className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Criar
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Pipelines novos vêm com estágios padrão. O pipeline ★ recebe as conversas novas.
        </p>
      </div>
    </div>
  );
}
