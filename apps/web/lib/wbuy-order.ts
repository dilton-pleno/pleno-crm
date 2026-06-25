import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WbuyOrder, WbuyAbandonedCart } from "@/lib/wbuy";

interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  sku: string | null;
}

function digits(s: string | undefined | null): string {
  return (s ?? "").replace(/\D/g, "");
}

function parseOrderDate(data: string | undefined): Date {
  if (!data) return new Date();
  const d = new Date(data.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Acha o contato do pedido por email ou telefone; cria um novo se não existir.
 * O telefone é comparado pelos últimos 8 dígitos (formatos divergem entre Wbuy
 * e os canais de atendimento).
 */
async function findOrCreateContact(cliente: WbuyOrder["cliente"]): Promise<string> {
  const email = cliente?.email?.trim().toLowerCase() || null;
  const phoneDigits = digits(cliente?.telefone2 || cliente?.telefone1);

  let contact = email
    ? await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })
    : null;

  if (!contact && phoneDigits.length >= 8) {
    contact = await prisma.contact.findFirst({
      where: { phone: { endsWith: phoneDigits.slice(-8) } },
    });
  }

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        name: cliente?.nome?.trim() || "Cliente Wbuy",
        email,
        phone: phoneDigits || null,
      },
    });
  }

  return contact.id;
}

/**
 * Upsert idempotente de um pedido Wbuy no CRM (chave: external_id), vinculando
 * ao contato. Usado pelo webhook e pela sincronização.
 */
export async function upsertWbuyOrder(order: WbuyOrder): Promise<void> {
  const contactId = await findOrCreateContact(order.cliente);

  const items: OrderItem[] = (order.produtos ?? []).map((p) => ({
    name: p.produto ?? "Produto",
    quantity: Number(p.qtd ?? 1),
    unit_price: Number(p.valor ?? 0),
    sku: p.sku ?? p.cod ?? null,
  }));

  const total = new Prisma.Decimal(Number(order.valor_total?.total ?? 0));
  const status = order.status?.nome ?? "—";
  const createdAt = parseOrderDate(order.data);
  const externalId = String(order.id);

  const data = {
    contactId,
    platform: "wbuy",
    status,
    total,
    items: items as unknown as Prisma.InputJsonValue,
    syncedAt: new Date(),
  };

  await prisma.order.upsert({
    where: { externalId },
    update: data,
    create: { ...data, externalId, createdAt },
  });
}

/**
 * Atualiza apenas o status de um pedido existente (webhook order_status).
 * Não cria pedido novo — se ainda não foi sincronizado, ignora.
 */
export async function updateWbuyOrderStatus(
  pedidoId: string,
  statusNome: string
): Promise<void> {
  await prisma.order.updateMany({
    where: { externalId: String(pedidoId) },
    data: { status: statusNome, syncedAt: new Date() },
  });
}

/**
 * Upsert de carrinho abandonado (webhook abandoned_cart). Chave: id_envio.
 */
export async function upsertAbandonedCart(cart: WbuyAbandonedCart): Promise<void> {
  if (!cart.id_envio) return;

  const produtos = cart.produtos ?? [];
  let total = 0;
  let itemsCount = 0;
  for (const p of produtos) {
    const qty = Number(p.quantidade ?? 1);
    total += Number(p.valor ?? 0) * qty;
    itemsCount += qty;
  }

  const data = {
    customerName: cart.cliente?.nome ?? null,
    customerEmail: cart.cliente?.email ?? null,
    customerPhone: cart.cliente?.telefone ? digits(cart.cliente.telefone) : null,
    total: new Prisma.Decimal(total),
    itemsCount,
    products: produtos as unknown as Prisma.InputJsonValue,
  };

  await prisma.abandonedCart.upsert({
    where: { externalId: String(cart.id_envio) },
    update: data,
    create: { ...data, externalId: String(cart.id_envio) },
  });
}
