"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Pencil, KeyRound, X, Copy, Check } from "lucide-react";

type Role = "ADMIN" | "GESTOR" | "ATENDENTE";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Super Admin",
  GESTOR: "Gerente",
  ATENDENTE: "Atendente",
};

const ROLE_OPTIONS: Role[] = ["ADMIN", "GESTOR", "ATENDENTE"];

interface Props {
  currentUserId: string;
}

export function UsuariosClient({ currentUserId }: Props) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/users");
      if (res.ok) {
        const json = (await res.json()) as { data: UserItem[] };
        setUsers(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleResetPassword = useCallback(async (user: UserItem) => {
    const res = await fetch(`/api/v1/users/${user.id}/reset-password`, { method: "POST" });
    if (res.ok) {
      const json = (await res.json()) as { data: { password: string } };
      setResetResult({ name: user.name, password: json.data.password });
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Usuários</h1>
        <button
          onClick={() => setModal("create")}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90"
        >
          <UserPlus className="w-3.5 h-3.5" /> Novo usuário
        </button>
      </div>

      {resetResult && (
        <ResetPasswordBanner
          name={resetResult.name}
          password={resetResult.password}
          onClose={() => setResetResult(null)}
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-[10px] text-muted-foreground">(você)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <span className="text-xs text-muted-foreground w-24 text-center">{ROLE_LABELS[u.role]}</span>
              <span
                className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${
                  u.active
                    ? "bg-green-500/10 text-green-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {u.active ? "Ativo" : "Inativo"}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => {
                    setEditing(u);
                    setModal("edit");
                  }}
                  className="p-1.5 text-muted-foreground hover:bg-accent rounded"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => void handleResetPassword(u)}
                  className="p-1.5 text-muted-foreground hover:bg-accent rounded"
                  title="Redefinir senha"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === "create" && (
        <UserFormModal
          mode="create"
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void fetchUsers();
          }}
        />
      )}

      {modal === "edit" && editing && (
        <UserFormModal
          mode="edit"
          user={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => {
            setModal(null);
            setEditing(null);
          }}
          onSaved={() => {
            setModal(null);
            setEditing(null);
            void fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function ResetPasswordBanner({
  name,
  password,
  onClose,
}: {
  name: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [password]);

  return (
    <div className="bg-primary/5 border border-primary/30 rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground">
          Nova senha de <span className="font-medium">{name}</span> (copie agora, não será exibida novamente):
        </p>
        <code className="text-sm font-mono text-foreground">{password}</code>
      </div>
      <button
        onClick={() => void copy()}
        className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-2.5 py-1.5 hover:opacity-90"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
      <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function UserFormModal({
  mode,
  user,
  isSelf = false,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  user?: UserItem;
  isSelf?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: (user?.role ?? "ATENDENTE") as Role,
    active: user?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const isCreate = mode === "create";
      const url = isCreate ? "/api/v1/users" : `/api/v1/users/${user!.id}`;
      const method = isCreate ? "POST" : "PATCH";
      const body = isCreate
        ? {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            active: form.active,
          }
        : {
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            active: form.active,
          };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        onSaved();
      } else {
        setError(json.error?.message ?? "Falha ao salvar");
      }
    } finally {
      setSaving(false);
    }
  }, [form, mode, user, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-background border border-border rounded-lg shadow-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {mode === "create" ? "Novo usuário" : "Editar usuário"}
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nome"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="E-mail"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {mode === "create" && (
          <input
            type="text"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Senha (mín. 8 caracteres)"
            className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}

        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          Papel
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            disabled={isSelf}
            className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {isSelf && <span className="text-[10px]">Você não pode alterar a própria role.</span>}
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            disabled={isSelf}
            className="rounded border-border"
          />
          Usuário ativo
          {isSelf && (
            <span className="text-[10px] text-muted-foreground">(não é possível desativar a própria conta)</span>
          )}
        </label>

        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={
              saving ||
              !form.name.trim() ||
              !form.email.trim() ||
              (mode === "create" && form.password.length < 8)
            }
            className="text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
