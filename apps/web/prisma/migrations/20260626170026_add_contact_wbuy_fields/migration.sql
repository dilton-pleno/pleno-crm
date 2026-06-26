-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "addresses" JSONB,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "document" TEXT,
ADD COLUMN     "document2" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "secondary_phone" TEXT,
ADD COLUMN     "uf" TEXT,
ADD COLUMN     "wbuy_customer_id" TEXT;
