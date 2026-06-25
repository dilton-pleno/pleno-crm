import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { Zap, ArrowLeft } from "lucide-react";

export default async function AutomacoesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "automacoes")) redirect("/atendimento");

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2">
        <Link href="/configuracoes" className="p-1.5 text-muted-foreground hover:bg-accent rounded-md">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Automações</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 text-center py-20 bg-card border border-border rounded-lg">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="w-7 h-7 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium text-foreground">Em desenvolvimento</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            O módulo de automações (fluxos automáticos de atendimento e campanhas)
            está em desenvolvimento e estará disponível em breve.
          </p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-primary bg-primary/10 rounded-full px-2.5 py-1">
          Módulo 6
        </span>
      </div>
    </div>
  );
}
