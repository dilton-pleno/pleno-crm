import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAccessLevel } from "@/lib/permissions";
import { MessageCircle, Hash, ArrowLeft } from "lucide-react";
import { ContactEditCard } from "./contact-edit";

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  email: "E-mail",
  site: "Site",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  pending: "Pendente",
  resolved: "Resolvida",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-500/10 text-green-600",
  pending: "bg-yellow-500/10 text-yellow-600",
  resolved: "bg-muted text-muted-foreground",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContatoPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session) notFound();

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      channels: true,
      conversations: {
        orderBy: { updatedAt: "desc" },
        include: {
          messages: { orderBy: { sentAt: "desc" }, take: 1 },
          channel: { select: { channelType: true } },
        },
      },
      orders: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!contact) notFound();

  const canEdit = getAccessLevel(session.user.role, "contatos") === "full";

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6 max-w-4xl mx-auto">
      {/* Voltar */}
      <Link
        href="/atendimento"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para atendimento
      </Link>

      {/* Cabeçalho do contato (editável) */}
      <ContactEditCard
        id={contact.id}
        name={contact.name}
        email={contact.email}
        phone={contact.phone}
        notes={contact.notes}
        canEdit={canEdit}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna principal: histórico de conversas */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            Histórico de conversas ({contact.conversations.length})
          </h2>

          {contact.conversations.length === 0 && (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              Nenhuma conversa registrada
            </div>
          )}

          {contact.conversations.map((conv) => {
            const lastMsg = conv.messages[0];
            return (
              <Link
                key={conv.id}
                href={`/atendimento?conversation=${conv.id}`}
                className="bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {CHANNEL_LABELS[conv.channel.channelType] ?? conv.channel.channelType}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[conv.status] ?? ""}`}
                  >
                    {STATUS_LABELS[conv.status] ?? conv.status}
                  </span>
                </div>
                {lastMsg && (
                  <p className="mt-2 text-sm text-muted-foreground truncate">
                    {lastMsg.direction === "out" ? "Você: " : ""}
                    {lastMsg.content ?? "[mídia]"}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {conv.updatedAt.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </Link>
            );
          })}
        </div>

        {/* Coluna lateral: canais e pedidos */}
        <div className="flex flex-col gap-4">
          {/* Canais vinculados */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Canais vinculados</h2>
            {contact.channels.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum canal</p>
            )}
            <div className="flex flex-col gap-2">
              {contact.channels.map((ch) => (
                <div key={ch.id} className="flex items-center gap-2 text-sm">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">
                    {CHANNEL_LABELS[ch.channelType] ?? ch.channelType}
                  </span>
                  <span className="text-foreground truncate">{ch.channelIdentifier}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico de pedidos */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Histórico de pedidos
            </h2>
            {contact.orders.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Integração com e-commerce em breve
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {contact.orders.map((order) => (
                  <div key={order.id} className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-foreground font-medium">
                        #{order.externalId}
                      </span>
                      <span className="text-foreground">
                        R$ {Number(order.total).toFixed(2)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{order.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
