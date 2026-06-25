// Cliente da Google Merchant Center Content API. PENDENTE de validação com
// credenciais reais. Ainda não exercitado em runtime.

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

async function accessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Credenciais OAuth do Google não configuradas");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth falhou [${res.status}]`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/**
 * Lista o status de aprovação dos produtos no Merchant Center.
 */
export async function getProductStatus(
  merchantId: string
): Promise<MerchantProductStatus[]> {
  const token = await accessToken();
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
