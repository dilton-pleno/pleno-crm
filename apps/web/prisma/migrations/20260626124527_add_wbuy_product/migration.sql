-- CreateTable
CREATE TABLE "wbuy_products" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "cod" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "category_url" TEXT,
    "gtin" TEXT,
    "ncm" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wbuy_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wbuy_products_external_id_key" ON "wbuy_products"("external_id");
