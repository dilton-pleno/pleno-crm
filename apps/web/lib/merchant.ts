// Cliente da Google Merchant Center Content API. PENDENTE de validação com
// credenciais reais. Ainda não exercitado em runtime.

import { getGoogleAccessToken } from "@/lib/google-config";

export interface MerchantProductStatus {
  id: string;
  title: string;
  status: string;
  issues: unknown;
  clicks: number;
  impressions: number;
}

interface ContentApiStatus {
  productId?: string;
  title?: string;
  destinationStatuses?: Array<{ status?: string }>;
  itemLevelIssues?: unknown;
}

/**
 * Lista o status de aprovação dos produtos no Merchant Center.
 */
export async function getProductStatus(
  merchantId: string
): Promise<MerchantProductStatus[]> {
  const token = await getGoogleAccessToken();
  const res = await fetch(
    `https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/productstatuses`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Merchant Content API falhou [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as { resources?: ContentApiStatus[] };
  return (json.resources ?? []).map((p) => ({
    id: p.productId ?? "",
    title: p.title ?? "",
    status: p.destinationStatuses?.[0]?.status ?? "unknown",
    issues: p.itemLevelIssues ?? null,
    clicks: 0,
    impressions: 0,
  }));
}
