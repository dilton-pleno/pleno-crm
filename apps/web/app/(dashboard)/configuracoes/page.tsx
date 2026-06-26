import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SlidersHorizontal, Zap, Users, Plug, ChevronRight, Tag, MessageSquareText } from "lucide-react";

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/atendimento");

  const items = [
    {
      href: "/configuracoes/usuarios",
      icon: Users,
      title: "Usuários",
      description: "Gerenciar usuários, papéis e acesso",
    },
    {
      href: "/configuracoes/integracoes",
      icon: Plug,
      title: "Integrações",
      description: "Conexão do WhatsApp e demais serviços",
    },
    {
      href: "/configuracoes/pipeline",
      icon: SlidersHorizontal,
      title: "Pipeline do Kanban",
      description: "Criar pipelines e gerenciar estágios",
    },
    {
      href: "/configuracoes/etiquetas",
      icon: Tag,
      title: "Etiquetas",
      description: "Criar e organizar etiquetas de leads e suas cores",
    },
    {
      href: "/configuracoes/respostas-rapidas",
      icon: MessageSquareText,
      title: "Respostas rápidas",
      description: "Mensagens prontas para o atendimento",
    },
    {
      href: "/configuracoes/automacoes",
      icon: Zap,
      title: "Automações",
      description: "Fluxos automáticos (Módulo 6)",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-foreground">Configurações</h1>

      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
