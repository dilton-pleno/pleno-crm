"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Role } from "@pleno-crm/types";
import { Bell, LogOut } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  GESTOR: "Gestor",
  ATENDENTE: "Atendente",
};

interface Notification {
  id: string;
  message: string;
  href: string;
}

interface HeaderProps {
  userName: string;
  userRole: Role;
}

export function Header({ userName, userRole }: HeaderProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  // Apenas Admin e Gestor recebem alertas de solicitação de reconexão.
  const canApprove = userRole === "ADMIN" || userRole === "GESTOR";

  useWebSocket({
    "integration:reconnect_requested": (payload) => {
      if (!canApprove) return;
      const requestId = typeof payload.requestId === "string" ? payload.requestId : "";
      const requesterName =
        typeof payload.requesterName === "string" ? payload.requesterName : "Atendente";
      setNotifications((prev) => {
        if (prev.some((n) => n.id === requestId)) return prev;
        return [
          {
            id: requestId,
            message: `Solicitação de reconexão WhatsApp de ${requesterName}`,
            href: "/configuracoes/integracoes",
          },
          ...prev,
        ];
      });
    },
  });

  const handleClick = useCallback(
    (notification: Notification) => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      setOpen(false);
      router.push(notification.href);
    },
    [router]
  );

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background sticky top-0 z-10">
      <div />

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="relative p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title="Notificações"
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-background border border-border rounded-lg shadow-lg z-30 overflow-hidden">
                <div className="px-3 py-2 border-b border-border text-xs font-medium text-foreground">
                  Notificações
                </div>
                {notifications.length === 0 ? (
                  <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                    Nenhuma notificação
                  </p>
                ) : (
                  <ul className="max-h-72 overflow-auto">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleClick(n)}
                          className="w-full text-left px-3 py-2.5 text-xs text-foreground hover:bg-accent transition-colors border-b border-border last:border-0"
                        >
                          {n.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

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
