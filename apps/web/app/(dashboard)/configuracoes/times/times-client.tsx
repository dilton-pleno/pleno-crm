"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Users, Radio, SlidersHorizontal, Save, Crown } from "lucide-react";

export interface UserOption { id: string; name: string; email: string; role: string }
export interface Option { id: string; name: string }
export interface TeamMemberDetail {
  user_id: string;
  name: string;
  email: string;
  role: string;
  is_manager: boolean;
}
export interface TeamDetail {
  id: string;
  name: string;
  members: TeamMemberDetail[];
  inbox_ids: string[];
  pipeline_ids: string[];
}

interface Props {
  initialTeams: TeamDetail[];
  users: UserOption[];
  inboxes: Option[];
  pipelines: Option[];
}

export function TimesClient({ initialTeams, users, inboxes, pipelines }: Props) {
  const [teams, setTeams] = useState<TeamDetail[]>(initialTeams);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTeam = useCallback(async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (res.ok) {
        setTeams((prev) => [...prev, json.data as TeamDetail]);
        setNewName("");
      } else {
        setError(json.error?.message ?? "Falha ao criar time");
      }
    } finally {
      setBusy(false);
    }
  }, [newName, busy]);

  const removeTeam = useCallback(async (id: string) => {
    if (!confirm("Excluir este time? Os vínculos de membros, Canais e pipelines serão removidos.")) return;
    setTeams((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/v1/teams/${id}`, { method: "DELETE" });
  }, []);

  const patchLocal = useCallback((id: string, patch: Partial<TeamDetail>) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/configuracoes" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Times</h1>
          <p className="text-sm text-muted-foreground">
            Setores com membros, Canais e pipelines. A visibilidade por time é aplicada na próxima etapa.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Novo time */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-2 shrink-0">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void createTeam(); }}
          placeholder="Nome do novo time (ex.: Vendas, Suporte)…"
          className="flex-1 text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={() => void createTeam()}
          disabled={!newName.trim() || busy}
          className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" /> Criar time
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum time ainda.</p>
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              users={users}
              inboxes={inboxes}
              pipelines={pipelines}
              onPatch={(patch) => patchLocal(team.id, patch)}
              onRemove={() => void removeTeam(team.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TeamCard({
  team, users, inboxes, pipelines, onPatch, onRemove,
}: {
  team: TeamDetail;
  users: UserOption[];
  inboxes: Option[];
  pipelines: Option[];
  onPatch: (patch: Partial<TeamDetail>) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(team.name);
  const [savingName, setSavingName] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [savingInboxes, setSavingInboxes] = useState(false);
  const [savingPipelines, setSavingPipelines] = useState(false);

  const memberMap = new Map(team.members.map((m) => [m.user_id, m]));

  const toggleMember = (userId: string) => {
    if (memberMap.has(userId)) {
      onPatch({ members: team.members.filter((m) => m.user_id !== userId) });
    } else {
      const u = users.find((x) => x.id === userId);
      if (!u) return;
      onPatch({
        members: [...team.members, { user_id: u.id, name: u.name, email: u.email, role: u.role, is_manager: false }],
      });
    }
  };

  const toggleManager = (userId: string) => {
    onPatch({
      members: team.members.map((m) => (m.user_id === userId ? { ...m, is_manager: !m.is_manager } : m)),
    });
  };

  const toggleInbox = (id: string) => {
    onPatch({
      inbox_ids: team.inbox_ids.includes(id)
        ? team.inbox_ids.filter((x) => x !== id)
        : [...team.inbox_ids, id],
    });
  };

  const togglePipeline = (id: string) => {
    onPatch({
      pipeline_ids: team.pipeline_ids.includes(id)
        ? team.pipeline_ids.filter((x) => x !== id)
        : [...team.pipeline_ids, id],
    });
  };

  const saveName = async () => {
    if (!name.trim() || name.trim() === team.name) return;
    setSavingName(true);
    try {
      await fetch(`/api/v1/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      onPatch({ name: name.trim() });
    } finally {
      setSavingName(false);
    }
  };

  const saveMembers = async () => {
    setSavingMembers(true);
    try {
      await fetch(`/api/v1/teams/${team.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: team.members.map((m) => ({ user_id: m.user_id, is_manager: m.is_manager })) }),
      });
    } finally {
      setSavingMembers(false);
    }
  };

  const saveInboxes = async () => {
    setSavingInboxes(true);
    try {
      await fetch(`/api/v1/teams/${team.id}/inboxes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inbox_ids: team.inbox_ids }),
      });
    } finally {
      setSavingInboxes(false);
    }
  };

  const savePipelines = async () => {
    setSavingPipelines(true);
    try {
      await fetch(`/api/v1/teams/${team.id}/pipelines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_ids: team.pipeline_ids }),
      });
    } finally {
      setSavingPipelines(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          className="flex-1 text-sm font-semibold bg-background border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {savingName && <span className="text-[10px] text-muted-foreground">salvando…</span>}
        <button onClick={onRemove} className="p-1.5 text-destructive hover:bg-destructive/10 rounded" title="Excluir time">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Membros */}
      <Section icon={Users} title="Membros" onSave={() => void saveMembers()} saving={savingMembers}>
        <div className="flex flex-col gap-1 max-h-52 overflow-auto pr-1">
          {users.map((u) => {
            const inTeam = memberMap.has(u.id);
            const m = memberMap.get(u.id);
            return (
              <div key={u.id} className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input type="checkbox" checked={inTeam} onChange={() => toggleMember(u.id)} className="cursor-pointer" />
                  <span className="text-foreground">{u.name}</span>
                  <span className="text-[10px] text-muted-foreground">{u.role}</span>
                </label>
                {inTeam && (
                  <button
                    onClick={() => toggleManager(u.id)}
                    className={`flex items-center gap-1 text-[11px] rounded px-2 py-0.5 border ${
                      m?.is_manager ? "bg-amber-500/10 border-amber-500/40 text-amber-600" : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                    title="Gestor do time"
                  >
                    <Crown className="w-3 h-3" /> Gestor
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Canais */}
      <Section icon={Radio} title="Canais" onSave={() => void saveInboxes()} saving={savingInboxes}>
        {inboxes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum Canal cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {inboxes.map((i) => (
              <label key={i.id} className="flex items-center gap-1.5 text-sm border border-border rounded-md px-2 py-1 cursor-pointer hover:bg-accent">
                <input type="checkbox" checked={team.inbox_ids.includes(i.id)} onChange={() => toggleInbox(i.id)} className="cursor-pointer" />
                {i.name}
              </label>
            ))}
          </div>
        )}
      </Section>

      {/* Pipelines */}
      <Section icon={SlidersHorizontal} title="Pipelines" onSave={() => void savePipelines()} saving={savingPipelines}>
        {pipelines.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum pipeline cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pipelines.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm border border-border rounded-md px-2 py-1 cursor-pointer hover:bg-accent">
                <input type="checkbox" checked={team.pipeline_ids.includes(p.id)} onChange={() => togglePipeline(p.id)} className="cursor-pointer" />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon: Icon, title, onSave, saving, children,
}: {
  icon: React.ElementType; title: string; onSave: () => void; saving: boolean; children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <button
          onClick={onSave}
          disabled={saving}
          className="ml-auto flex items-center gap-1 text-[11px] bg-primary text-primary-foreground rounded px-2 py-1 hover:opacity-90 disabled:opacity-40"
        >
          <Save className="w-3 h-3" /> {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {children}
    </div>
  );
}
