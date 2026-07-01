import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGoogleConfig } from "@/lib/google-config";
import { resolveAdStoreId } from "@/lib/ads-store";
import type { Ga4Row } from "@/lib/ga4";

// Upsert de métricas GA4 (uma linha por dia/origem/mídia), carimbando a loja
// dona da property (mapa conta→loja). Compartilhado pelo pull (in-app) e pela
// rota interna que recebe dados via POST — mantém o carimbo de loja num só lugar.
export async function upsertGa4Rows(rows: Ga4Row[]): Promise<number> {
  const { ga4PropertyId } = await getGoogleConfig();
  const storeIntegrationId = await resolveAdStoreId("ga4", ga4PropertyId);

  let count = 0;
  for (const r of rows) {
    // source/medium compõem a chave única; normalizamos null p/ evitar que o
    // Postgres trate NULLs como distintos e duplique linhas.
    const source = r.source ?? "unknown";
    const medium = r.medium ?? "unknown";
    const day = new Date(`${r.date}T00:00:00.000Z`);
    const data = {
      date: day,
      source,
      medium,
      storeIntegrationId,
      sessions: r.sessions,
      users: r.users,
      pageviews: r.pageviews,
      bounceRate: new Prisma.Decimal(r.bounceRate),
    };
    await prisma.ga4Metric.upsert({
      where: { date_source_medium: { date: day, source, medium } },
      update: data,
      create: data,
    });
    count++;
  }
  return count;
}
