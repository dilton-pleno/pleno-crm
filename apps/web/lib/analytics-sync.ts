import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { AdPlatform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional().nullable(),
  impressions: z.number().int().nonnegative().default(0),
  reach: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  spend: z.number().nonnegative().default(0),
  cpm: z.number().nonnegative().default(0),
  ctr: z.number().nonnegative().default(0),
  roas: z.number().nonnegative().default(0),
  conversions: z.number().int().nonnegative().default(0),
});

export const campaignSyncSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  account_id: z.string().optional(),
  campaigns: z.array(campaignSchema),
});

export type CampaignSyncInput = z.infer<typeof campaignSyncSchema>;

/**
 * Upsert idempotente de métricas de campanha pela chave única
 * (platform, campaignId, date). Compartilhado entre Meta Ads e Google Ads.
 */
export async function upsertCampaignMetrics(
  platform: AdPlatform,
  input: CampaignSyncInput,
  fallbackAccountId: string
): Promise<number> {
  const day = new Date(`${input.date}T00:00:00.000Z`);
  const accountId = input.account_id ?? fallbackAccountId;

  for (const c of input.campaigns) {
    const data = {
      platform,
      accountId,
      campaignId: c.id,
      campaignName: c.name,
      status: c.status ?? null,
      date: day,
      impressions: c.impressions,
      reach: c.reach,
      clicks: c.clicks,
      spend: new Prisma.Decimal(c.spend),
      cpm: new Prisma.Decimal(c.cpm),
      ctr: new Prisma.Decimal(c.ctr),
      roas: new Prisma.Decimal(c.roas),
      conversions: c.conversions,
    };
    await prisma.campaignMetric.upsert({
      where: { platform_campaignId_date: { platform, campaignId: c.id, date: day } },
      update: data,
      create: data,
    });
  }

  return input.campaigns.length;
}
