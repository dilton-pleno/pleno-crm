-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "media_data" BYTEA,
ADD COLUMN     "media_file_name" TEXT,
ADD COLUMN     "media_mime_type" TEXT;
