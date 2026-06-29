import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { getMetaAdsStatus, saveMetaAdsConfig } from "@/lib/meta-ads-config";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;
  return NextResponse.json({ data: await getMetaAdsStatus() });
}

const schema = z.object({
  access_token: z.string().optional(),
  ad_account_id: z.string().optional(),
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

  await saveMetaAdsConfig({
    accessToken: parsed.data.access_token,
    adAccountId: parsed.data.ad_account_id,
  });

  return NextResponse.json({ data: await getMetaAdsStatus() });
}
