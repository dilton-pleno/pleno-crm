"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUp, ArrowDown, Trash2, Check, X, Settings } from "lucide-react";
import { PipelineManager } from "@/components/kanban/pipeline-manager";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  card_count: number;
}

interface PipelineOption {
  id: string;
  name: string;
  is_default: boolean;
}

interface Props {
  pipelineId: string;
  pipelineName: string;
  pipelines: PipelineOption[];
  initialStages: Stage[];
}

export function PipelineConfigClient({ pipelineId, pipelineName, pipelines, initialStages }: Props) {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sortStages = (list: Stage[]) => [...list].sort((a, b) => a.position - b.position);

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/pipelines/${pipelineId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newColor }),
      });
      const json = await res.json();
      if (res.ok) {
        const s = json.data as { id: string; name: string; color: string; position: number };
        setStages((prev) => sortStages([...prev, { ...s, card_count: 0 }]));
        setNewName("");
        setNewColor("#6366f1");
      } else {
        setError(json.error?.message ?? "Falha ao criar estágio");
      }
    } finally {
      setBusy(false);
    }
  }, [newName, newColor, pipelineId, busy]);

  const patchStage = useCallback(
    async (id: string, data: Partial<Pick<Stage, "name" | "color" | "position">>) => {
      const res = await fetch(`/api/v1/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok;
    },
    []
  );

  const handleRename = useCallback(
    async (id: string) => {
      const name = editingName.trim();
      if (!name) return;
      const ok = await patchStage(id, { name });
      if (ok) {
        setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
      }
      setEditingId(null);
    },
    [editingName, patchStage]
  );

  const handleColor = useCallback(
    async (id: string, color: string) => {
      setStages((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
      await patchStage(id, { color });
    },
    [patchStage]
  );

  const handleReorder = useCallback(
    async (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= stages.length) return;
      const a = stages[index];
      const b = stages[target];
      if (!a || !b) return;
      // Troca as posições no banco e localmente.
      await Promise.all([
        patchStage(a.id, { position: b.position }),
        patchStage(b.id, { position: a.position }),
      ]);
      setStages((prev) =>
        sortStages(
          prev.map((s) => {
            if (s.id === a.id) return { ...s, position: b.position };
            if (s.id === b.id) return { ...s, position: a.position };
            return s;
          })
        )
      );
    },
    [stages, patchStage]
  );

  const handleDelete = useCallback(async (id: string) => {
    setError(null);
    const res = await fetch(`/api/v1/stages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStages((prev) => prev.filter((s) => s.id !== id));
    } else {
      const json = await res.json();
      setError(json.error?.message ?? "Falha ao remover estágio");
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Configuração do pipeline</h1>
          <p className="text-sm text-muted-foreground">Estágios de {pipelineName}</p>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 1 && (
            <select
              value={pipelineId}
              onChange={(e) => router.push(`/configuracoes/pipeline?pipeline=${e.target.value}`)}
              className="text-sm bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_default ? " ★" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setManageOpen(true)}
            className="flex items-center gap-1 text-xs bg-card border border-border rounded-md px-3 py-2 hover:bg-accent text-foreground"
          >
            <Settings className="w-3.5 h-3.5" /> Gerenciar pipelines
          </button>
        </div>
      </div>

      {manageOpen && (
        <PipelineManager
          pipelines={pipelines}
          currentPipelineId={pipelineId}
          onClose={() => setManageOpen(false)}
          onChanged={(nextSelected) => {
            if (nextSelected) router.push(`/configuracoes/pipeline?pipeline=${nextSelected}`);
            else router.refresh();
          }}
        />
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Lista de estágios */}
      <div className="flex flex-col gap-2">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2.5"
          >
            <input
              type="color"
              value={stage.color}
              onChange={(e) => void handleColor(stage.id, e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent"
              title="Cor do estágio"
            />

            {editingId === stage.id ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  className="flex-1 text-sm bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button onClick={() => void handleRename(stage.id)} className="p-1.5 text-green-600 hover:bg-accent rounded">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:bg-accent rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingId(stage.id);
                  setEditingName(stage.name);
                }}
                className="flex-1 text-left text-sm font-medium text-foreground hover:underline"
              >
                {stage.name}
              </button>
            )}

            <span className="text-xs text-muted-foreground">{stage.card_count} card(s)</span>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => void handleReorder(index, -1)}
                disabled={index === 0}
                className="p-1.5 text-muted-foreground hover:bg-accent rounded disabled:opacity-30"
                title="Mover para cima"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => void handleReorder(index, 1)}
                disabled={index === stages.length - 1}
                className="p-1.5 text-muted-foreground hover:bg-accent rounded disabled:opacity-30"
                title="Mover para baixo"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => void handleDelete(stage.id)}
                className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                title="Remover estágio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Novo estágio */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent"
          title="Cor do novo estágio"
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
          placeholder="Nome do novo estágio..."
          className="flex-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={() => void handleAdd()}
          disabled={!newName.trim() || busy}
          className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
    </div>
  );
}
