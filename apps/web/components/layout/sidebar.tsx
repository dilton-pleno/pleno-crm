import Link from "next/link";
import { canAccess } from "@/lib/permissions";
import type { Role, Module } from "@pleno-crm/types";
import {
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  LayoutGrid,
  BarChart2,
  ShoppingCart,
  Users,
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

const NAV_ITEMS: NavItem[] = [
  { label: "Visão geral",  href: "/visao-geral", icon: LayoutDashboard, module: "visao_geral" },
  { label: "Atendimento", href: "/atendimento", icon: MessageCircle, module: "atendimento" },
  { label: "Comentários", href: "/atendimento/comentarios", icon: MessageSquare, module: "atendimento" },
  { label: "Kanban",      href: "/kanban",      icon: LayoutGrid,    module: "kanban"      },
  { label: "Contatos",    href: "/contatos",    icon: Users,         module: "contatos"    },
  { label: "Campanhas",   href: "/campanhas",   icon: BarChart2,     module: "campanhas"   },
  { label: "Ecommerce",   href: "/ecommerce",   icon: ShoppingCart,  module: "ecommerce"   },
  { label: "Automações",  href: "/configuracoes/automacoes", icon: Zap, module: "automacoes" },
  // Integrações fica só para Gestor/Atendente: o Admin acessa por Configurações.
  { label: "Integrações", href: "/configuracoes/integracoes", icon: Plug, module: "integracoes", roles: ["GESTOR", "ATENDENTE"] },
  { label: "Configurações", href: "/configuracoes", icon: Settings,  module: "configuracoes" },
];

interface SidebarProps {
  role: Role;
  currentPath: string;
}

export function Sidebar({ role, currentPath }: SidebarProps) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => canAccess(role, item.module) && (!item.roles || item.roles.includes(role))
  );

  // Destaca apenas o item mais específico (href mais longo) que casa com a rota,
  // evitando que "/atendimento" e "/atendimento/comentarios" fiquem ativos juntos.
  const activeHref = visibleItems
    .filter((item) => currentPath === item.href || currentPath.startsWith(item.href + "/"))
    .reduce<string | null>(
      (best, item) => (best && best.length >= item.href.length ? best : item.href),
      null
    );

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
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeHref === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
