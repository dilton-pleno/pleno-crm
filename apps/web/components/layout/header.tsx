"use client";

import { signOut } from "next-auth/react";
import type { Role } from "@pleno-crm/types";
import { Bell, LogOut } from "lucide-react";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  GESTOR: "Gestor",
  ATENDENTE: "Atendente",
};

interface HeaderProps {
  userName: string;
  userRole: Role;
}

export function Header({ userName, userRole }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background sticky top-0 z-10">
      <div />

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          title="Notificações"
        >
          <Bell size={18} />
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground leading-none">
              {userName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ROLE_LABEL[userRole]}
            </p>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
