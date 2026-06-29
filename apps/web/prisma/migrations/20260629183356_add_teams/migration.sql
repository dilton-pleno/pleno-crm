-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_manager" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "team_inboxes" (
    "team_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,

    CONSTRAINT "team_inboxes_pkey" PRIMARY KEY ("team_id","inbox_id")
);

-- CreateTable
CREATE TABLE "team_pipelines" (
    "team_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,

    CONSTRAINT "team_pipelines_pkey" PRIMARY KEY ("team_id","pipeline_id")
);

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

-- CreateIndex
CREATE INDEX "team_inboxes_inbox_id_idx" ON "team_inboxes"("inbox_id");

-- CreateIndex
CREATE INDEX "team_pipelines_pipeline_id_idx" ON "team_pipelines"("pipeline_id");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_inboxes" ADD CONSTRAINT "team_inboxes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_inboxes" ADD CONSTRAINT "team_inboxes_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_pipelines" ADD CONSTRAINT "team_pipelines_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_pipelines" ADD CONSTRAINT "team_pipelines_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
