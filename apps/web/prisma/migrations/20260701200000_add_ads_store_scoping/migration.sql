-- ROI/Marketing por loja: vincula contas de anúncio (Meta/Google/GA4) a lojas.
-- Carimba as métricas existentes na "Loja principal" e cria o mapa conta→loja,
-- de forma ATÔMICA (sem janela de dados órfãos). Não-destrutivo.

-- 1) store_integration_id nas métricas de anúncios e de GA4.
ALTER TABLE "campaign_metrics" ADD COLUMN "store_integration_id" TEXT;
ALTER TABLE "ga4_metrics"      ADD COLUMN "store_integration_id" TEXT;

CREATE INDEX "campaign_metrics_store_integration_id_idx" ON "campaign_metrics"("store_integration_id");
CREATE INDEX "ga4_metrics_store_integration_id_idx" ON "ga4_metrics"("store_integration_id");

ALTER TABLE "campaign_metrics" ADD CONSTRAINT "campaign_metrics_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ga4_metrics" ADD CONSTRAINT "ga4_metrics_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Mapa conta de anúncio → loja (platform: "meta" | "google" | "ga4").
CREATE TABLE "ad_account_stores" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "store_integration_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_account_stores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ad_account_stores_platform_account_id_key" ON "ad_account_stores"("platform", "account_id");
CREATE INDEX "ad_account_stores_store_integration_id_idx" ON "ad_account_stores"("store_integration_id");
ALTER TABLE "ad_account_stores" ADD CONSTRAINT "ad_account_stores_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Backfill: carimba métricas existentes na "Loja principal" (se existir).
UPDATE "campaign_metrics" SET "store_integration_id" = '00000000-0000-0000-0000-000000000002' WHERE "store_integration_id" IS NULL AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002');
UPDATE "ga4_metrics"      SET "store_integration_id" = '00000000-0000-0000-0000-000000000002' WHERE "store_integration_id" IS NULL AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002');

-- 4) Cria o mapa das contas de anúncio já vistas em campaign_metrics → Loja principal.
INSERT INTO "ad_account_stores" ("id", "platform", "account_id", "store_integration_id", "created_at")
SELECT gen_random_uuid(), cm."platform"::text, cm."account_id", '00000000-0000-0000-0000-000000000002', now()
FROM (SELECT DISTINCT "platform", "account_id" FROM "campaign_metrics" WHERE COALESCE("account_id", '') <> '') cm
WHERE EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002')
ON CONFLICT ("platform", "account_id") DO NOTHING;

-- 5) GA4: mapa da property configurada (id no config do provider "google") → Loja principal.
INSERT INTO "ad_account_stores" ("id", "platform", "account_id", "store_integration_id", "created_at")
SELECT gen_random_uuid(), 'ga4', ic."config"->>'ga4PropertyId', '00000000-0000-0000-0000-000000000002', now()
FROM "integration_configs" ic
WHERE ic."provider" = 'google' AND COALESCE(ic."config"->>'ga4PropertyId', '') <> ''
  AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002')
ON CONFLICT ("platform", "account_id") DO NOTHING;
