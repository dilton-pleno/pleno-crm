-- AlterTable
ALTER TABLE "post_comments" ADD COLUMN     "inbox_id" TEXT,
ADD COLUMN     "platform" TEXT;

-- CreateIndex
CREATE INDEX "post_comments_inbox_id_idx" ON "post_comments"("inbox_id");

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: comentários existentes pertencem ao Canal Padrão e à plataforma
-- Instagram (origem atual do recurso de comentários).
UPDATE "post_comments" SET "inbox_id" = '00000000-0000-0000-0000-000000000001' WHERE "inbox_id" IS NULL;
UPDATE "post_comments" SET "platform" = 'instagram' WHERE "platform" IS NULL;
