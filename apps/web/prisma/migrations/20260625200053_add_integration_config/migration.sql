-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_user" TEXT,
    "api_secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_provider_key" ON "integration_configs"("provider");
