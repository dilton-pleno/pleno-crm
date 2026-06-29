"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Phone, Mail, Pencil, Check, X, Instagram } from "lucide-react";

interface Props {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagramHandle: string | null;
  canEdit: boolean;
}

export function ContactEditCard({ id, name, email, phone, instagramHandle, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name,
    email: email ?? "",
    phone: phone ?? "",
    instagram: instagramHandle ?? "",
  });

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          instagram_handle: form.instagram.trim() || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }, [form, id, saving, router]);

  if (editing) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 flex flex-col gap-3">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nome"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="Telefone"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="E-mail"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          value={form.instagram}
          onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
          placeholder="@ do Instagram (ex.: meucuidado)"
          className="text-sm bg-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" /> Salvar
          </button>
          <button
            onClick={() => {
              setForm({ name, email: email ?? "", phone: phone ?? "", instagram: instagramHandle ?? "" });
              setEditing(false);
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-accent rounded-md px-3 py-1.5"
          >
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground">{name}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {phone}
              </span>
            )}
            {email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </span>
            )}
            {instagramHandle && (
              <span className="flex items-center gap-1">
                <Instagram className="w-3.5 h-3.5" />
                @{instagramHandle}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        )}
      </div>
    </div>
  );
}
