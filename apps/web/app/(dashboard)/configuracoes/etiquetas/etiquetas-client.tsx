"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { TagChip } from "@/components/ui/tag-chip";

interface Tag {
  id: string;
  name: string;
  color: string;
  contact_count: number;
}

export const TAG_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#64748b",
];

const DEFAULT_COLOR = "#6366f1";

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {TAG_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full border ${value.toLowerCase() === c ? "ring-2 ring-offset-1 ring-foreground/40" : "border-border"}`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border border-border bg-transparent"
        title="Cor personalizada"
      />
    </div>
  );
}

export function EtiquetasClient({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = useCallback(async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newColor }),
      });
      const json = await res.json();
      if (res.ok) {
        setTags((prev) =>
          [...prev, { ...(json.data as Tag), contact_count: 0 }].sort((a, b) => a.name.localeCompare(b.name))
        );
        setNewName("");
        setNewColor(DEFAULT_COLOR);
      } else {
        setError(json.error?.message ?? "Falha ao criar etiqueta");
      }
    } finally {
      setBusy(false);
    }
  }, [newName, newColor, busy]);

  const patch = useCallback(async (id: string, data: { name?: string; color?: string }) => {
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t)).sort((a, b) => a.name.localeCompare(b.name))
    );
    await fetch(`/api/v1/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }, []);

  const remove = useCallback(async (id: string) => {
    if (!confirm("Excluir esta etiqueta? Ela será removida de todos os contatos.")) return;
    setTags((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/v1/tags/${id}`, { method: "DELETE" });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/configuracoes" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Etiquetas</h1>
          <p className="text-sm text-muted-foreground">Organize leads e escolha as cores</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Nova etiqueta */}
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 shrink-0">
        <p className="text-sm font-semibold text-foreground">Nova etiqueta</p>
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            placeholder="Nome da etiqueta…"
            className="flex-1 text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <TagChip tag={{ id: "preview", name: newName.trim() || "Prévia", color: newColor }} />
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} />
        <button
          onClick={() => void create()}
          disabled={!newName.trim() || busy}
          className="self-start flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Criar etiqueta
        </button>
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma etiqueta ainda.</p>
        ) : (
          tags.map((t) => (
            <div key={t.id} className="bg-card border border-border rounded-lg px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={t.color}
                  onChange={(e) => void patch(t.id, { color: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent flex-shrink-0"
                  title="Cor"
                />
                {editingId === t.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="flex-1 text-sm bg-background border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => {
                        if (editName.trim()) void patch(t.id, { name: editName.trim() });
                        setEditingId(null);
                      }}
                      className="p-1.5 text-green-600 hover:bg-accent rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:bg-accent rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <TagChip tag={t} />
                    </div>
                    <span className="text-xs text-muted-foreground">{t.contact_count} contato(s)</span>
                    <button
                      onClick={() => {
                        setEditingId(t.id);
                        setEditName(t.name);
                      }}
                      className="p-1.5 text-muted-foreground hover:bg-accent rounded"
                      title="Renomear"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void remove(t.id)}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
