-- CreateTable: integrações como instâncias nomeadas reutilizáveis.
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "wa_instance" TEXT,
    "wa_phone_number_id" TEXT,
    "meta_page_id" TEXT,
    "meta_ig_id" TEXT,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- Índices de roteamento
CREATE INDEX "integrations_type_idx" ON "integrations"("type");
CREATE INDEX "integrations_wa_instance_idx" ON "integrations"("wa_instance");
CREATE INDEX "integrations_wa_phone_number_id_idx" ON "integrations"("wa_phone_number_id");
CREATE INDEX "integrations_meta_page_id_idx" ON "integrations"("meta_page_id");
CREATE INDEX "integrations_meta_ig_id_idx" ON "integrations"("meta_ig_id");

-- AlterTable: vínculos do Canal com as integrações (1:1 via UNIQUE).
ALTER TABLE "inboxes" ADD COLUMN     "whatsapp_integration_id" TEXT;
ALTER TABLE "inboxes" ADD COLUMN     "meta_integration_id" TEXT;

CREATE UNIQUE INDEX "inboxes_whatsapp_integration_id_key" ON "inboxes"("whatsapp_integration_id");
CREATE UNIQUE INDEX "inboxes_meta_integration_id_key" ON "inboxes"("meta_integration_id");

ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_whatsapp_integration_id_fkey" FOREIGN KEY ("whatsapp_integration_id") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_meta_integration_id_fkey" FOREIGN KEY ("meta_integration_id") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
