/**
 * Limpeza pré-entrega — apaga TODAS as conversas e os contatos que NÃO são da Wbuy.
 *
 * "Contato Wbuy" = tem ao menos um pedido (orders) OU wbuy_customer_id preenchido.
 * Esses são MANTIDOS. Contatos de teste vindos de conversas (sem pedido e sem
 * wbuy_customer_id) são APAGADOS.
 *
 * Cascatas do schema fazem o resto com segurança:
 *   - apagar conversa  -> messages + pipeline_cards (onDelete: Cascade)
 *   - apagar contato   -> contact_channels + contact_notes + vínculos de tags
 * NÃO toca em: orders, abandoned_carts, post_comments, tags.
 *
 * Uso (a partir de apps/web, com DATABASE_URL apontando para o banco alvo):
 *   node --env-file=.env --import tsx prisma/cleanup-pre-entrega.ts            # DRY-RUN (só conta)
 *   node --env-file=.env --import tsx prisma/cleanup-pre-entrega.ts --confirm  # APAGA de verdade
 *
 * SEMPRE faça backup antes (pg_dump -Fc). A operação é irreversível.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Filtro do que será APAGADO: contato sem pedido e sem wbuy_customer_id.
const NAO_WBUY: Prisma.ContactWhereInput = { wbuyCustomerId: null, orders: { none: {} } };

async function main(): Promise<void> {
  const confirm = process.argv.includes("--confirm");

  const [conversas, mensagens, cards, contatosTotal, apagarContatos] = await Promise.all([
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.pipelineCard.count(),
    prisma.contact.count(),
    prisma.contact.count({ where: NAO_WBUY }),
  ]);
  const manterContatos = contatosTotal - apagarContatos;

  console.log("=== PRÉVIA DA LIMPEZA ===");
  console.log(`Conversas a apagar .......... ${conversas}`);
  console.log(`  Mensagens (cascata) ....... ${mensagens}`);
  console.log(`  Cards do kanban (cascata) . ${cards}`);
  console.log(`Contatos no total ........... ${contatosTotal}`);
  console.log(`  MANTER (Wbuy) ............. ${manterContatos}`);
  console.log(`  APAGAR (não-Wbuy) ......... ${apagarContatos}`);
  console.log("=========================");

  if (!confirm) {
    console.log("\nDRY-RUN: nada foi apagado. Rode novamente com --confirm para executar.");
    return;
  }

  console.log("\n--confirm detectado. Apagando dentro de uma transação...");

  const result = await prisma.$transaction(async (tx) => {
    // 1) Todas as conversas (cascata: mensagens + cards).
    const delConversas = await tx.conversation.deleteMany({});
    // 2) Contatos não-Wbuy (cascata: channels + notes + vínculos de tags).
    const delContatos = await tx.contact.deleteMany({ where: NAO_WBUY });
    return { delConversas, delContatos };
  });

  const [conversasRestantes, contatosRestantes] = await Promise.all([
    prisma.conversation.count(),
    prisma.contact.count(),
  ]);

  console.log("\n=== CONCLUÍDO ===");
  console.log(`Conversas apagadas .......... ${result.delConversas.count}`);
  console.log(`Contatos apagados ........... ${result.delContatos.count}`);
  console.log(`Conversas restantes ......... ${conversasRestantes}`);
  console.log(`Contatos restantes (Wbuy) ... ${contatosRestantes}`);
  console.log("=================");
}

main()
  .catch((err) => {
    console.error("Falha na limpeza:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
