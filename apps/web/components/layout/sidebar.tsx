"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccess } from "@/lib/permissions";
import type { Role, Module } from "@pleno-crm/types";
import {
  LayoutDashboard,
  Inbox,
  Hash,
  LayoutGrid,
  BarChart2,
  ShoppingCart,
  Users,
  UsersRound,
  Settings,
  Zap,
  Plug,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  module: Module;
  /** Restringe o item a papéis específicos (além da permissão do módulo). */
  roles?: Role[];
}

// Itens fora da Caixa de Entrada (esta é renderizada à parte, com os Canais).
const NAV_ITEMS: NavItem[] = [
  { label: "Visão geral",  href: "/visao-geral", icon: LayoutDashboard, module: "visao_geral" },
  { label: "Kanban",      href: "/kanban",      icon: LayoutGrid,    module: "kanban"      },
  { label: "Contatos",    href: "/contatos",    icon: Users,         module: "contatos"    },
  { label: "Campanhas",   href: "/campanhas",   icon: BarChart2,     module: "campanhas"   },
  { label: "Ecommerce",   href: "/ecommerce",   icon: ShoppingCart,  module: "ecommerce"   },
  { label: "Automações",  href: "/configuracoes/automacoes", icon: Zap, module: "automacoes" },
  // Times: o Gestor gerencia os seus por aqui; o Admin acessa por Configurações.
  { label: "Times", href: "/configuracoes/times", icon: UsersRound, module: "atendimento", roles: ["GESTOR"] },
  // Integrações fica só para Gestor/Atendente: o Admin acessa por Configurações.
  { label: "Integrações", href: "/configuracoes/integracoes", icon: Plug, module: "integracoes", roles: ["GESTOR", "ATENDENTE"] },
  { label: "Configurações", href: "/configuracoes", icon: Settings,  module: "configuracoes" },
];

export interface SidebarInbox {
  id: string;
  name: string;
}

interface SidebarProps {
  role: Role;
  inboxes: SidebarInbox[];
}

const itemClass = (active: boolean) =>
  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
  }`;

export function Sidebar({ role, inboxes }: SidebarProps) {
  // usePathname atualiza a cada navegação client-side; o layout (server) persiste
  // entre rotas e não acompanharia a URL, por isso a decisão de item ativo é aqui.
  const currentPath = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => canAccess(role, item.module) && (!item.roles || item.roles.includes(role))
  );

  // Destaca apenas o item mais específico (href mais longo) que casa com a rota.
  const activeHref = visibleItems
    .filter((item) => currentPath === item.href || currentPath.startsWith(item.href + "/"))
    .reduce<string | null>(
      (best, item) => (best && best.length >= item.href.length ? best : item.href),
      null
    );

  const showInbox = canAccess(role, "atendimento");
  const inCanal = currentPath.startsWith("/atendimento/canais/");
  // "Todos os canais" cobre /atendimento e /atendimento/comentarios (não Canais).
  const todosActive = currentPath.startsWith("/atendimento") && !inCanal;

  return (
    <aside className="w-[240px] shrink-0 bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <h1 className="text-sidebar-foreground font-semibold text-base tracking-tight">
          Pleno CRM
        </h1>
        <p className="text-sidebar-foreground/50 text-xs mt-0.5">
          Meu Cuidado Essencial
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* Visão geral */}
        {visibleItems
          .filter((i) => i.module === "visao_geral")
          .map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={itemClass(activeHref === item.href)}>
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}

        {/* Caixa de Entrada: Todos os canais + lista de Canais */}
        {showInbox && (
          <div className="pt-3">
            <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/40">
              Caixa de Entrada
            </p>
            <Link href="/atendimento" className={itemClass(todosActive)}>
              <Inbox size={16} />
              Todos os canais
            </Link>
            {inboxes.map((inbox) => {
              const href = `/atendimento/canais/${inbox.id}`;
              const active = currentPath === href || currentPath.startsWith(href + "/");
              return (
                <Link key={inbox.id} href={href} className={itemClass(active)}>
                  <Hash size={16} />
                  <span className="truncate">{inbox.name}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Demais módulos */}
        <div className="pt-3 space-y-0.5">
          {visibleItems
            .filter((i) => i.module !== "visao_geral")
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={itemClass(activeHref === item.href)}>
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
        </div>
      </nav>
    </aside>
  );
}
