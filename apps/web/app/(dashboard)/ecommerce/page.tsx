import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { ShoppingCart } from "lucide-react";

export default async function EcommercePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const role = session.user.role as Role;
  if (!canAccess(role, "ecommerce")) redirect("/atendimento");

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-semibold text-foreground">Ecommerce</h1>

      <div className="flex flex-col items-center justify-center gap-3 text-center py-20 bg-card border border-border rounded-lg">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="w-7 h-7 text-primary" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium text-foreground">Em desenvolvimento</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            A integração com o e-commerce (Wbuy) — pedidos, status e histórico de
            compras dos contatos — está em desenvolvimento e estará disponível em breve.
          </p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-primary bg-primary/10 rounded-full px-2.5 py-1">
          Módulo 5
        </span>
      </div>
    </div>
  );
}
