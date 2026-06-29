import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/lib/api-auth";
import { getMetaStatus, saveMetaConfig } from "@/lib/meta-config";

export async function GET(): Promise<NextResponse> {
  const guard = await requireAccess("integracoes", "full");
  if (!guard.ok) return guard.response;
  return NextResponse.json({ data: await getMetaStatus() });
}

const schema = z.object({
  app_id: z.string().optional(),
  app_secret: z.string().optional(),
  access_token: z.string().optional(),
  page_id: z.string().optional(),
  ad_account_id: z.string().optional(),
  verify_token: z.string().optional(),
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

  await saveMetaConfig({
    appId: parsed.data.app_id,
    appSecret: parsed.data.app_secret,
    accessToken: parsed.data.access_token,
    pageId: parsed.data.page_id,
    adAccountId: parsed.data.ad_account_id,
    verifyToken: parsed.data.verify_token,
  });

  return NextResponse.json({ data: await getMetaStatus() });
}
