-- E-commerce multi-loja: cada loja é uma Integration (type "ecommerce"), e os
-- dados de e-commerce passam a ser escopados por loja (store_integration_id).
-- Cria a "Loja principal" a partir do IntegrationConfig "wbuy" e faz o backfill
-- dos registros existentes de forma ATÔMICA (sem janela de dados órfãos).

-- 1) Integration ganha "platform" (ecommerce: "wbuy" | futuro "nuvemshop").
ALTER TABLE "integrations" ADD COLUMN     "platform" TEXT;

-- 2) store_integration_id nos 5 modelos de dados de e-commerce.
ALTER TABLE "orders" ADD COLUMN                 "store_integration_id" TEXT;
ALTER TABLE "wbuy_products" ADD COLUMN          "store_integration_id" TEXT;
ALTER TABLE "wbuy_reviews" ADD COLUMN           "store_integration_id" TEXT;
ALTER TABLE "newsletter_subscribers" ADD COLUMN "store_integration_id" TEXT;
ALTER TABLE "abandoned_carts" ADD COLUMN        "store_integration_id" TEXT;

-- 3) Uniques globais viram compostos (evita colisão de external_id/email entre lojas).
DROP INDEX "orders_external_id_key";
DROP INDEX "wbuy_products_external_id_key";
DROP INDEX "wbuy_reviews_external_id_key";
DROP INDEX "abandoned_carts_external_id_key";
DROP INDEX "newsletter_subscribers_email_key";

CREATE UNIQUE INDEX "orders_store_integration_id_external_id_key" ON "orders"("store_integration_id", "external_id");
CREATE UNIQUE INDEX "wbuy_products_store_integration_id_external_id_key" ON "wbuy_products"("store_integration_id", "external_id");
CREATE UNIQUE INDEX "wbuy_reviews_store_integration_id_external_id_key" ON "wbuy_reviews"("store_integration_id", "external_id");
CREATE UNIQUE INDEX "abandoned_carts_store_integration_id_external_id_key" ON "abandoned_carts"("store_integration_id", "external_id");
CREATE UNIQUE INDEX "newsletter_subscribers_store_integration_id_email_key" ON "newsletter_subscribers"("store_integration_id", "email");

-- 4) Índices de roteamento por loja.
CREATE INDEX "orders_store_integration_id_idx" ON "orders"("store_integration_id");
CREATE INDEX "wbuy_products_store_integration_id_idx" ON "wbuy_products"("store_integration_id");
CREATE INDEX "wbuy_reviews_store_integration_id_idx" ON "wbuy_reviews"("store_integration_id");
CREATE INDEX "newsletter_subscribers_store_integration_id_idx" ON "newsletter_subscribers"("store_integration_id");
CREATE INDEX "abandoned_carts_store_integration_id_idx" ON "abandoned_carts"("store_integration_id");

-- 5) FKs (ON DELETE RESTRICT: não apagar loja com dados).
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wbuy_products" ADD CONSTRAINT "wbuy_products_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wbuy_reviews" ADD CONSTRAINT "wbuy_reviews_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "abandoned_carts" ADD CONSTRAINT "abandoned_carts_store_integration_id_fkey" FOREIGN KEY ("store_integration_id") REFERENCES "integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) Cria a "Loja principal" (id fixo) a partir do IntegrationConfig "wbuy", se houver.
--    api_secret já está cifrado (AES-256-GCM), então é copiado como apiSecretEnc.
INSERT INTO "integrations" ("id", "type", "name", "provider", "platform", "active", "config", "created_at", "updated_at")
SELECT '00000000-0000-0000-0000-000000000002', 'ecommerce', 'Loja principal', NULL, 'wbuy', true,
       jsonb_build_object('apiUser', ic."api_user", 'apiSecretEnc', ic."api_secret"),
       now(), now()
FROM "integration_configs" ic
WHERE ic."provider" = 'wbuy'
ON CONFLICT ("id") DO NOTHING;

-- 7) Backfill: vincula todos os registros existentes à "Loja principal" (se criada).
UPDATE "orders"                 SET "store_integration_id" = '00000000-0000-0000-0000-000000000002' WHERE "store_integration_id" IS NULL AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002');
UPDATE "wbuy_products"          SET "store_integration_id" = '00000000-0000-0000-0000-000000000002' WHERE "store_integration_id" IS NULL AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002');
UPDATE "wbuy_reviews"           SET "store_integration_id" = '00000000-0000-0000-0000-000000000002' WHERE "store_integration_id" IS NULL AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002');
UPDATE "newsletter_subscribers" SET "store_integration_id" = '00000000-0000-0000-0000-000000000002' WHERE "store_integration_id" IS NULL AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002');
UPDATE "abandoned_carts"        SET "store_integration_id" = '00000000-0000-0000-0000-000000000002' WHERE "store_integration_id" IS NULL AND EXISTS (SELECT 1 FROM "integrations" WHERE "id" = '00000000-0000-0000-0000-000000000002');
