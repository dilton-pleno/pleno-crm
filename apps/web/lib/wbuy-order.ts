import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WbuyOrder, WbuyAbandonedCart, WbuyCustomerAddress } from "@/lib/wbuy";
import {
  digits,
  isPlaceholderName,
  buildContactUpdate,
  mapAddress,
  CONTACT_ENRICH_SELECT,
} from "@/lib/wbuy-customer";

interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  sku: string | null;
}

function parseOrderDate(data: string | undefined): Date {
  if (!data) return new Date();
  const d = new Date(data.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Converte o endereço inline do cliente do pedido no formato de endereço Wbuy. */
function inlineAddress(cliente: NonNullable<WbuyOrder["cliente"]>): WbuyCustomerAddress | null {
  if (!cliente.endereco?.trim() && !cliente.cep?.trim()) return null;
  return {
    cep: cliente.cep,
    endereco: cliente.endereco,
    endnum: cliente.endnum,
    bairro: cliente.bairro,
    complemento: cliente.complemento,
    cidade: cliente.cidade,
    uf: cliente.uf,
  };
}

/**
 * Acha o contato do pedido por email ou telefone; cria um novo se não existir.
 * O telefone é comparado pelos últimos 8 dígitos (formatos divergem entre Wbuy
 * e os canais de atendimento). Em ambos os casos enriquece o contato com os
 * dados do cliente do pedido (CPF, cidade/UF, endereço, telefone secundário) e
 * corrige nomes placeholder.
 */
async function findOrCreateContact(cliente: WbuyOrder["cliente"]): Promise<string> {
  const email = cliente?.email?.trim().toLowerCase() || null;
  const phoneDigits = digits(cliente?.telefone2 || cliente?.telefone1);
  const phone1Digits = digits(cliente?.telefone1);

  const select = CONTACT_ENRICH_SELECT;

  let contact = email
    ? await prisma.contact.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select,
      })
    : null;

  if (!contact && phoneDigits.length >= 8) {
    contact = await prisma.contact.findFirst({
      where: { phone: { endsWith: phoneDigits.slice(-8) } },
      select,
    });
  }

  const addr = cliente ? inlineAddress(cliente) : null;

  if (!contact) {
    const created = await prisma.contact.create({
      data: {
        name: cliente?.nome?.trim() && !isPlaceholderName(cliente.nome)
          ? cliente.nome.trim()
          : "Cliente Wbuy",
        email,
        // usa o telefone1 como principal; telefone2 vira secundário
        phone: phone1Digits || phoneDigits || null,
        secondaryPhone: phoneDigits && phoneDigits !== phone1Digits ? phoneDigits : null,
        document: cliente?.doc1?.trim() || null,
        document2: cliente?.doc2?.trim() || null,
        city: cliente?.cidade?.trim() || null,
        uf: cliente?.uf?.trim() || null,
        wbuyCustomerId: cliente?.id ? String(cliente.id) : null,
        addresses: addr ? ([mapAddress(addr)] as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    return created.id;
  }

  // Contato já existe: enriquece preenchendo lacunas e corrigindo nome placeholder.
  const update = buildContactUpdate(contact, {
    name: cliente?.nome,
    email,
    phone: phone1Digits || phoneDigits || null,
    document: cliente?.doc1?.trim() || null,
    document2: cliente?.doc2?.trim() || null,
    secondaryPhone: cliente?.telefone2 ? digits(cliente.telefone2) : null,
    city: cliente?.cidade?.trim() || null,
    uf: cliente?.uf?.trim() || null,
    wbuyCustomerId: cliente?.id ? String(cliente.id) : null,
    addresses: addr ? [mapAddress(addr)] : null,
  });

  if (Object.keys(update).length > 0) {
    await prisma.contact.update({ where: { id: contact.id }, data: update });
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

  const tracking = order.frete?.rastreio?.trim() || null;
  const carrier = order.frete?.nome?.trim() || null;
  const trackingUrl = order.frete?.rastreio_url?.trim() || null;

  const data = {
    contactId,
    platform: "wbuy",
    status,
    total,
    items: items as unknown as Prisma.InputJsonValue,
    tracking,
    carrier,
    trackingUrl,
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
