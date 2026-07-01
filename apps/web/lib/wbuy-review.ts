import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/websocket";
import type { WbuyReviewRaw } from "@/lib/wbuy";

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // Aceita "AAAA/MM/DD H:i:s" ou "AAAA-MM-DD HH:MM:SS".
  const d = new Date(s.replace(/\//g, "-").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Sincroniza avaliações e dispara alerta no sino para cada avaliação NOVA
 * (que ainda não existia no banco). Retorna a contagem total e de novas.
 */
export async function syncReviews(reviews: WbuyReviewRaw[], storeIntegrationId: string): Promise<{ synced: number; created: number }> {
  const valid = reviews.filter((r) => r.id);
  if (valid.length === 0) return { synced: 0, created: 0 };

  const ids = valid.map((r) => String(r.id));
  const existing = await prisma.wbuyReview.findMany({
    where: { externalId: { in: ids }, storeIntegrationId },
    select: { externalId: true },
  });
  const known = new Set(existing.map((e) => e.externalId));

  let created = 0;

  for (const r of valid) {
    const externalId = String(r.id);
    const isNew = !known.has(externalId);
    const rating = Number(r.nota ?? 0);
    const productName = r.produto ?? null;
    const customerName = r.nome ?? null;

    const data = {
      storeIntegrationId,
      productId: r.produto_id ?? null,
      productName,
      customerName,
      rating,
      comment: r.avaliacao ?? null,
      approved: r.ativo !== "0",
      reviewDate: parseDate(r.data_avaliacao ?? r.data),
    };

    await prisma.wbuyReview.upsert({
      where: { storeIntegrationId_externalId: { storeIntegrationId, externalId } },
      update: data,
      create: { ...data, externalId, alertedAt: isNew ? new Date() : null },
    });

    if (isNew) {
      created++;
      const stars = "⭐".repeat(Math.max(0, Math.min(5, rating)));
      const message = `Nova avaliação ${stars} de ${customerName ?? "cliente"}${
        productName ? ` em ${productName}` : ""
      }`;
      const notification = await prisma.alertNotification.create({
        data: { message, link: "/ecommerce/avaliacoes" },
      });
      emitEvent("alert:triggered", { notificationId: notification.id, message });
    }
  }

  return { synced: valid.length, created };
}
