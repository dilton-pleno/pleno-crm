import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { getGoogleStatus, saveGoogleConfig } from "@/lib/google-config";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;
  return NextResponse.json({ data: await getGoogleStatus() });
}

const schema = z.object({
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  refresh_token: z.string().optional(),
  ads_developer_token: z.string().optional(),
  ads_customer_id: z.string().optional(),
  ga4_property_id: z.string().optional(),
  merchant_id: z.string().optional(),
});

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 422 }
    );
  }

  await saveGoogleConfig({
    clientId: parsed.data.client_id,
    clientSecret: parsed.data.client_secret,
    refreshToken: parsed.data.refresh_token,
    adsDeveloperToken: parsed.data.ads_developer_token,
    adsCustomerId: parsed.data.ads_customer_id,
    ga4PropertyId: parsed.data.ga4_property_id,
    merchantId: parsed.data.merchant_id,
  });

  return NextResponse.json({ data: await getGoogleStatus() });
}
