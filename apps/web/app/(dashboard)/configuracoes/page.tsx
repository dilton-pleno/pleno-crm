import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SlidersHorizontal, Users, Plug, Tag, MessageSquareText, Radio, UsersRound } from "lucide-react";

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
      href: "/configuracoes/canais",
      icon: Radio,
      title: "Canais",
      description: "Caixas de atendimento (WhatsApp + Instagram + Facebook) por setor",
    },
    {
      href: "/configuracoes/times",
      icon: UsersRound,
      title: "Times",
      description: "Setores com membros, Canais e pipelines (visibilidade por time)",
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
    // "Automações" fica no menu lateral (evita duplicação aqui).
  ];

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-4xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-foreground">Configurações</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 bg-card border border-border rounded-lg px-4 py-4 hover:bg-accent/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
