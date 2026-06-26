-- AlterTable
ALTER TABLE "pipelines" ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false;

-- Marca o pipeline mais antigo como padrão (recebe novas conversas).
UPDATE "pipelines"
SET "is_default" = true
WHERE "id" = (SELECT "id" FROM "pipelines" ORDER BY "created_at" ASC LIMIT 1);
