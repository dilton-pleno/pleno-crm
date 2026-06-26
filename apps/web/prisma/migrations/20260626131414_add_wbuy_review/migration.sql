-- AlterTable
ALTER TABLE "alert_notifications" ADD COLUMN     "link" TEXT,
ALTER COLUMN "alert_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "wbuy_reviews" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT,
    "customer_name" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "review_date" TIMESTAMP(3),
    "alerted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wbuy_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wbuy_reviews_external_id_key" ON "wbuy_reviews"("external_id");
