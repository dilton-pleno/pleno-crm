import { NextRequest, NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";

/**
 * Limpeza de retenção de mídia: zera `mediaData` (BYTEA) de mensagens em
 * conversas RESOLVIDAS há mais de X meses (mantém texto/legenda e os metadados
 * da mídia). Configurável por `MEDIA_RETENTION_MONTHS` (padrão 3). Chamado pelo
 * cron (N8N) periodicamente. Idempotente.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const months = Math.max(1, parseInt(process.env.MEDIA_RETENTION_MONTHS ?? "3", 10));
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const result = await prisma.message.updateMany({
    where: {
      mediaData: { not: null },
      sentAt: { lt: cutoff },
      conversation: { status: "resolved" },
    },
    data: { mediaData: null },
  });

  return NextResponse.json({ data: { months, cutoff: cutoff.toISOString(), cleared: result.count } });
}
