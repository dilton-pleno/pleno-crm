-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "instagram_handle" TEXT;

-- CreateIndex
CREATE INDEX "contacts_instagram_handle_idx" ON "contacts"("instagram_handle");
