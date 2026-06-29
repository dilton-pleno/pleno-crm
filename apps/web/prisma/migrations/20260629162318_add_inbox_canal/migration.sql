-- AlterTable
ALTER TABLE "contact_channels" ADD COLUMN     "inbox_id" TEXT;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "inbox_id" TEXT;

-- CreateTable
CREATE TABLE "inboxes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_instance" TEXT,
    "meta_page_id" TEXT,
    "meta_ig_id" TEXT,
    "meta_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_channels_inbox_id_idx" ON "contact_channels"("inbox_id");

-- CreateIndex
CREATE INDEX "conversations_inbox_id_idx" ON "conversations"("inbox_id");

-- AddForeignKey
ALTER TABLE "contact_channels" ADD CONSTRAINT "contact_channels_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill retroativo (zero downtime): cria o "Canal Padrão" e vincula
-- todas as conversas e handles existentes a ele. A instância WhatsApp e as
-- credenciais Meta por Canal são preenchidas nas fases seguintes.
INSERT INTO "inboxes" ("id", "name", "active", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Canal Padrão', true, now(), now());

UPDATE "conversations" SET "inbox_id" = '00000000-0000-0000-0000-000000000001' WHERE "inbox_id" IS NULL;
UPDATE "contact_channels" SET "inbox_id" = '00000000-0000-0000-0000-000000000001' WHERE "inbox_id" IS NULL;
