import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AdPlatform } from "@prisma/client";
import { requireRoles } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ store_integration_id: z.string().min(1) });

// Reatribui a conta de anúncio a outra loja e RE-CARIMBA as métricas históricas
// dessa conta, para o ROI por loja ficar coerente também no passado. Só ADMIN.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const guard = await requireRoles(["ADMIN"]);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }
  const newStoreId = parsed.data.store_integration_id;

  const mapping = await prisma.adAccountStore.findUnique({ where: { id } });
  if (!mapping) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Conta de anúncio não encontrada" } },
      { status: 404 }
    );
  }

  // A loja de destino precisa existir e ser uma loja (integração e-commerce).
  const store = await prisma.integration.findFirst({
    where: { id: newStoreId, type: "ecommerce" },
    select: { id: true },
  });
  if (!store) {
    return NextResponse.json(
      { error: { code: "INVALID_STORE", message: "Loja inválida" } },
      { status: 400 }
    );
  }

  const oldStoreId = mapping.storeIntegrationId;

  await prisma.$transaction(async (tx) => {
    await tx.adAccountStore.update({
      where: { id },
      data: { storeIntegrationId: newStoreId },
    });

    if (mapping.platform === "ga4") {
      // GA4 não tem coluna de conta nas métricas; move as linhas que estavam na
      // loja antiga (property única na prática) para a nova.
      await tx.ga4Metric.updateMany({
        where: { storeIntegrationId: oldStoreId },
        data: { storeIntegrationId: newStoreId },
      });
    } else {
      await tx.campaignMetric.updateMany({
        where: { platform: mapping.platform as AdPlatform, accountId: mapping.accountId },
        data: { storeIntegrationId: newStoreId },
      });
    }
  });

  return NextResponse.json({ data: { id, store_integration_id: newStoreId } });
}
