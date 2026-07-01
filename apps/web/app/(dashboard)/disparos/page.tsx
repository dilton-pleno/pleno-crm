import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Plus, Zap } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import type { Role } from "@pleno-crm/types";
import { prisma } from "@/lib/prisma";
import { getOfficialCloudInboxId } from "@/lib/inbox-routing";

// "Campanhas" = disparos ativos com objetivo pelo número OFICIAL (WhatsApp Cloud),
// rodando no engine de automações. Gatilhos de disparo: status de pedido, nº de
// compras, carrinho abandonado e agendado. Esta tela é uma visão curada dessas
// automações; a criação/edição acontece no builder de Automações.
const DISPATCH_TRIGGERS = ["order_status", "purchase_count", "abandoned_cart", "schedule"];

const TRIGGER_LABEL: Record<string, string> = {
  order_status: "Status de pedido",
  purchase_count: "Nº de compras",
  abandoned_cart: "Carrinho abandonado",
  schedule: "Agendado",
};

export default async function DisparosPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role as Role;
  if (!canAccess(role, "automacoes")) redirect("/atendimento");

  const [automations, officialInboxId] = await Promise.all([
    prisma.automation.findMany({
      where: { triggerType: { in: DISPATCH_TRIGGERS } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, active: true, triggerType: true, _count: { select: { runs: true } } },
    }),
    getOfficialCloudInboxId(),
  ]);

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-5 max-w-4xl mx-auto w-full">
      <div className="flex items-start gap-3 shrink-0">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Megaphone className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Disparos com objetivo pelo número oficial (WhatsApp API oficial) — status de pedido,
            fidelidade por nº de compras, recuperação e agendados.
          </p>
        </div>
        <Link
          href="/configuracoes/automacoes"
          className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-md px-3 py-2 hover:opacity-90 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Nova campanha
        </Link>
      </div>

      {!officialInboxId && (
        <div className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/40 rounded-md px-3 py-2.5">
          Nenhum Canal com <span className="font-medium">WhatsApp API oficial (Cloud)</span> configurado.
          Configure em <Link href="/configuracoes/canais" className="underline">Configurações → Canais</Link> para
          os disparos funcionarem.
        </div>
      )}

      {automations.length === 0 ? (
        <div className="text-sm text-muted-foreground bg-card border border-border rounded-lg p-6 text-center">
          Nenhuma campanha de disparo ainda. Crie uma automação com gatilho de status de pedido,
          nº de compras, carrinho abandonado ou agendado, com a ação <span className="font-medium">Enviar template</span>.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {automations.map((a) => (
            <Link
              key={a.id}
              href="/configuracoes/automacoes"
              className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-accent/40"
            >
              <Zap className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_LABEL[a.triggerType] ?? a.triggerType} · {a._count.runs} disparo(s)
                </p>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${a.active ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}
              >
                {a.active ? "Ativa" : "Inativa"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
