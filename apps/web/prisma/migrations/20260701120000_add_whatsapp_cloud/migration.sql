-- AlterTable: WhatsApp provider por Canal (Evolution x Meta Cloud API).
-- Zero downtime: default "evolution" preserva o comportamento atual dos Canais.
ALTER TABLE "inboxes" ADD COLUMN     "whatsapp_provider" TEXT NOT NULL DEFAULT 'evolution';
ALTER TABLE "inboxes" ADD COLUMN     "whatsapp_phone_number_id" TEXT;
ALTER TABLE "inboxes" ADD COLUMN     "whatsapp_config" JSONB;
