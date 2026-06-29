import Link from "next/link";
import { MessageCircle, MessageSquare } from "lucide-react";

interface InboxShellProps {
  /** Rota base do contexto: "/atendimento" (Todos) ou "/atendimento/canais/[id]". */
  basePath: string;
  /** Aba ativa. */
  active: "conversas" | "comentarios";
  /** Rótulo do contexto exibido à esquerda das abas. */
  label: string;
  children: React.ReactNode;
}

/**
 * Casca da Caixa de Entrada: barra com o nome do contexto (Canal ou "Todos os
 * canais") + abas Conversas | Comentários, e a área de conteúdo abaixo.
 */
export function InboxShell({ basePath, active, label, children }: InboxShellProps) {
  const conversasHref = basePath;
  const comentariosHref =
    basePath === "/atendimento" ? "/atendimento/comentarios" : `${basePath}/comentarios`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2 shrink-0">
        <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        <nav className="flex items-center gap-1 ml-1">
          <Tab href={conversasHref} active={active === "conversas"} icon={MessageCircle}>
            Conversas
          </Tab>
          <Tab href={comentariosHref} active={active === "comentarios"} icon={MessageSquare}>
            Comentários
          </Tab>
        </nav>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function Tab({
  href, active, icon: Icon, children,
}: {
  href: string; active: boolean; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 text-sm rounded-md px-3 py-1.5 transition-colors ${
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </Link>
  );
}
