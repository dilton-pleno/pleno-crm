import { prisma } from "@/lib/prisma";
import type { WbuyNewsletterRaw } from "@/lib/wbuy";

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Upsert dos inscritos da newsletter (chave: email). Paginado pelo chamador.
 */
export async function syncNewsletter(subs: WbuyNewsletterRaw[]): Promise<number> {
  let synced = 0;
  for (const s of subs) {
    const email = s.email?.trim().toLowerCase();
    if (!email) continue;
    const data = {
      name: s.nome ?? null,
      phone: s.telefone ? s.telefone.replace(/\D/g, "") : null,
      gender: s.genero ?? null,
      subscribed: s.ativo !== "0",
      signupDate: parseDate(s.data),
      syncedAt: new Date(),
    };
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: data,
      create: { ...data, email },
    });
    synced++;
  }
  return synced;
}
