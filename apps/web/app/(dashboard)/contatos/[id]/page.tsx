import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { MessageCircle, Phone, Mail, Hash, ArrowLeft } from "lucide-react";

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

      {/* Cabeçalho do contato */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold flex-shrink-0">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground">{contact.name}</h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              {contact.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {contact.phone}
                </span>
              )}
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {contact.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {contact.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">{contact.notes}</p>
          </div>
        )}
      </div>

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

          {/* Pedidos Wbuy */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Pedidos recentes
            </h2>
            {contact.orders.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum pedido — Módulo 5 (Wbuy) pendente
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
