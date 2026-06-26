"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import { TagChip, type TagData } from "@/components/ui/tag-chip";

const PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899"];

interface Props {
  contactId: string;
  initialTags: TagData[];
  canEdit?: boolean;
  onChange?: (tags: TagData[]) => void;
}

export function TagEditor({ contactId, initialTags, canEdit = false, onChange }: Props) {
  const [tags, setTags] = useState<TagData[]>(initialTags);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0] ?? "#6366f1");
  const [busy, setBusy] = useState(false);

  const update = useCallback(
    (next: TagData[]) => {
      setTags(next);
      onChange?.(next);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open || allTags.length > 0) return;
    void (async () => {
      const res = await fetch("/api/v1/tags");
      if (res.ok) {
        const json = (await res.json()) as { data: TagData[] };
        setAllTags(json.data);
      }
    })();
  }, [open, allTags.length]);

  const attach = useCallback(
    async (tag: TagData) => {
      if (tags.some((t) => t.id === tag.id)) return;
      update([...tags, tag]);
      await fetch(`/api/v1/contacts/${contactId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_id: tag.id }),
      });
    },
    [contactId, tags, update]
  );

  const detach = useCallback(
    async (tagId: string) => {
      update(tags.filter((t) => t.id !== tagId));
      await fetch(`/api/v1/contacts/${contactId}/tags?tag_id=${tagId}`, { method: "DELETE" });
    },
    [contactId, tags, update]
  );

  const createAndAttach = useCallback(async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newColor }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: TagData };
        setAllTags((prev) => [...prev, json.data]);
        await attach(json.data);
        setNewName("");
      }
    } finally {
      setBusy(false);
    }
  }, [newName, newColor, busy, attach]);

  const available = allTags.filter((t) => !tags.some((sel) => sel.id === t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChip key={t.id} tag={t} onRemove={canEdit ? () => void detach(t.id) : undefined} />
      ))}
      {tags.length === 0 && !canEdit && (
        <span className="text-[11px] text-muted-foreground">Sem etiquetas</span>
      )}

      {canEdit && (
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-dashed border-border rounded-full px-2 py-0.5 hover:bg-accent"
          >
            <Plus className="w-2.5 h-2.5" /> etiqueta
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute z-20 mt-1 w-52 bg-card border border-border rounded-md shadow-lg p-2 flex flex-col gap-1.5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void createAndAttach();
                      }}
                      placeholder="Nova etiqueta…"
                      className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => void createAndAttach()}
                      disabled={!newName.trim() || busy}
                      className="p-1 text-primary hover:bg-accent rounded disabled:opacity-40"
                      title="Criar e aplicar"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        className={`w-4 h-4 rounded-full border ${newColor.toLowerCase() === c ? "ring-2 ring-offset-1 ring-foreground/40" : "border-border"}`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                  {available.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground px-1 py-1">
                      Nenhuma etiqueta disponível
                    </p>
                  ) : (
                    available.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => void attach(t)}
                        className="flex items-center gap-2 text-left px-1.5 py-1 rounded hover:bg-accent"
                      >
                        <TagIcon className="w-3 h-3" style={{ color: t.color }} />
                        <span className="text-xs text-foreground truncate">{t.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
