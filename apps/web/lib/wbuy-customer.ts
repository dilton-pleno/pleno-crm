import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { WbuyCustomerRaw, WbuyCustomerAddress } from "@/lib/wbuy";

export function digits(s: string | undefined | null): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Detecta nomes "placeholder" criados a partir do identificador do canal
 * (ex.: "5522991025290:0", "Cliente Wbuy") — devem ser substituídos quando a
 * Wbuy fornece um nome real.
 */
export function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  const n = name.trim();
  if (!n || n === "Cliente Wbuy") return true;
  // Só dígitos, possivelmente com sufixo ":0" / "@..." (JID do WhatsApp).
  return /^[\d\s:+()-]+(@.*)?$/.test(n) || /^\d{6,}:\d+$/.test(n);
}

export function parseBirthDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const clean = s.trim();
  if (!clean || clean.startsWith("0000")) return null;
  const d = new Date(clean.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

interface NormalizedAddress {
  local: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export function mapAddress(a: WbuyCustomerAddress): NormalizedAddress {
  return {
    local: a.local?.trim() || null,
    cep: a.cep?.trim() || null,
    endereco: a.endereco?.trim() || null,
    numero: a.endnum?.trim() || null,
    complemento: a.complemento?.trim() || null,
    bairro: a.bairro?.trim() || null,
    cidade: a.cidade?.trim() || null,
    uf: a.uf?.trim() || null,
  };
}

interface EnrichInput {
  name?: string | null;
  document?: string | null;
  document2?: string | null;
  secondaryPhone?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  city?: string | null;
  uf?: string | null;
  email?: string | null;
  phone?: string | null;
  wbuyCustomerId?: string | null;
  addresses?: NormalizedAddress[] | null;
}

interface ExistingContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  city: string | null;
  uf: string | null;
  addresses: Prisma.JsonValue | null;
}

export const CONTACT_ENRICH_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  document: true,
  city: true,
  uf: true,
  addresses: true,
} as const;

/**
 * Monta o objeto de update mesclando os dados da Wbuy sobre um contato
 * existente. Campos vindos da Wbuy preenchem lacunas (não sobrescrevem
 * telefone/e-mail já existentes) e o nome só troca se for placeholder.
 */
export function buildContactUpdate(
  contact: ExistingContact,
  input: EnrichInput,
  opts: { replaceAddresses?: boolean } = {}
): Prisma.ContactUpdateInput {
  const update: Prisma.ContactUpdateInput = {};

  if (input.name && isPlaceholderName(contact.name) && !isPlaceholderName(input.name)) {
    update.name = input.name.trim();
  }
  if (!contact.email && input.email) update.email = input.email.trim().toLowerCase();
  if (!contact.phone && input.phone) update.phone = input.phone;

  // Dados Wbuy: a Wbuy é a fonte autoritativa, então atualiza quando vier valor.
  if (input.document) update.document = input.document;
  if (input.document2) update.document2 = input.document2;
  if (input.secondaryPhone) update.secondaryPhone = input.secondaryPhone;
  if (input.birthDate) update.birthDate = input.birthDate;
  if (input.gender) update.gender = input.gender;
  if (input.city) update.city = input.city;
  if (input.uf) update.uf = input.uf;
  if (input.wbuyCustomerId) update.wbuyCustomerId = input.wbuyCustomerId;

  // Endereços: o sync de clientes substitui a lista (replaceAddresses); o sync
  // de pedidos só preenche quando o contato ainda não tem nenhum endereço.
  const hasExistingAddresses = Array.isArray(contact.addresses) && contact.addresses.length > 0;
  if (input.addresses && input.addresses.length > 0 && (opts.replaceAddresses || !hasExistingAddresses)) {
    update.addresses = input.addresses as unknown as Prisma.InputJsonValue;
  }

  return update;
}

/**
 * Acha um contato existente por wbuyCustomerId, e-mail ou últimos 8 dígitos do
 * telefone. Não cria contato novo (o enriquecimento de clientes não deve gerar
 * contatos sem interação — quem compra já é criado pelo sync de pedidos).
 */
export async function matchContact(
  wbuyCustomerId: string | null,
  email: string | null,
  phoneDigits: string
): Promise<ExistingContact | null> {
  const select = CONTACT_ENRICH_SELECT;

  if (wbuyCustomerId) {
    const byId = await prisma.contact.findFirst({ where: { wbuyCustomerId }, select });
    if (byId) return byId;
  }
  if (email) {
    const byEmail = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select,
    });
    if (byEmail) return byEmail;
  }
  if (phoneDigits.length >= 8) {
    const byPhone = await prisma.contact.findFirst({
      where: { phone: { endsWith: phoneDigits.slice(-8) } },
      select,
    });
    if (byPhone) return byPhone;
  }
  return null;
}

/**
 * Enriquece um contato existente a partir de um cliente da Wbuy. Retorna true
 * se um contato foi encontrado e atualizado.
 */
export async function enrichContactFromCustomer(raw: WbuyCustomerRaw): Promise<boolean> {
  const email = raw.email?.trim().toLowerCase() || null;
  const phoneDigits = digits(raw.telefone2 || raw.telefone1);
  const wbuyId = raw.id ? String(raw.id) : null;

  const contact = await matchContact(wbuyId, email, phoneDigits);
  if (!contact) return false;

  const update = buildContactUpdate(contact, {
    name: raw.nome,
    document: raw.doc1?.trim() || null,
    document2: raw.doc2?.trim() || null,
    secondaryPhone: raw.telefone2 ? digits(raw.telefone2) : null,
    birthDate: parseBirthDate(raw.nascimento),
    city: raw.cidade?.trim() || null,
    uf: raw.uf?.trim() || null,
    email,
    phone: phoneDigits || null,
    wbuyCustomerId: wbuyId,
    addresses: (raw.enderecos ?? []).map(mapAddress),
  }, { replaceAddresses: true });

  if (Object.keys(update).length === 0) return false;
  await prisma.contact.update({ where: { id: contact.id }, data: update });
  return true;
}

/**
 * Enriquece contatos existentes a partir de uma página de clientes da Wbuy.
 * Paginado pelo chamador. Não cria contatos novos.
 */
export async function syncCustomers(
  customers: WbuyCustomerRaw[]
): Promise<{ enriched: number; skipped: number }> {
  let enriched = 0;
  let skipped = 0;
  for (const c of customers) {
    const ok = await enrichContactFromCustomer(c);
    if (ok) enriched++;
    else skipped++;
  }
  return { enriched, skipped };
}
