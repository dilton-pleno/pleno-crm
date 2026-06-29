-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('running', 'waiting', 'done', 'error');

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "contact_id" TEXT,
    "trigger" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'running',
    "current_position" INTEGER NOT NULL DEFAULT 0,
    "resume_at" TIMESTAMP(3),
    "context" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_runs_automation_id_idx" ON "automation_runs"("automation_id");

-- CreateIndex
CREATE INDEX "automation_runs_status_resume_at_idx" ON "automation_runs"("status", "resume_at");

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
