-- CreateEnum
CREATE TYPE "ScrapeSchedulePhase" AS ENUM ('BOOTSTRAP', 'COOLDOWN_90D', 'RECURRING_180D');

-- CreateEnum
CREATE TYPE "ScrapeLastRunKind" AS ENUM ('planned', 'on_demand');

-- CreateEnum
CREATE TYPE "ScrapeOnDemandRunStatus" AS ENUM ('running', 'success', 'failed', 'conflict');

-- AlterTable
ALTER TABLE "scrape_targets" ADD COLUMN "on_demand_allowed" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "scrape_coverages" ADD COLUMN "schedule_phase" "ScrapeSchedulePhase" NOT NULL DEFAULT 'BOOTSTRAP',
ADD COLUMN "next_scheduled_run_at" TIMESTAMP(3),
ADD COLUMN "scheduled_run_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_run_kind" "ScrapeLastRunKind";

-- Backfill lifecycle from existing coverage (see task-01-schema-e-migration §1.3).
-- Rows with last_lead_count >= 1 → COOLDOWN_90D; next run = max(last_run_at+90d, now) + jitter 0–7d from id.
UPDATE "scrape_coverages"
SET
  "schedule_phase" = 'COOLDOWN_90D',
  "next_scheduled_run_at" = GREATEST("last_run_at" + INTERVAL '90 days', NOW())
    + (("id" % 8) || ' days')::INTERVAL
WHERE "last_lead_count" IS NOT NULL AND "last_lead_count" >= 1;

-- CreateTable
CREATE TABLE "scrape_on_demand_states" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "scrape_target_id" INTEGER NOT NULL,
    "on_demand_enabled" BOOLEAN NOT NULL DEFAULT true,
    "bairro_order" JSONB NOT NULL DEFAULT '[]',
    "next_bairro_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrape_on_demand_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_on_demand_runs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "scrape_target_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" "ScrapeOnDemandRunStatus" NOT NULL,
    "leads_touched" INTEGER NOT NULL DEFAULT 0,
    "bairros_processed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scrape_on_demand_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scrape_on_demand_states_tenant_id_scrape_target_id_key" ON "scrape_on_demand_states"("tenant_id", "scrape_target_id");

-- CreateIndex
CREATE INDEX "scrape_on_demand_runs_tenant_id_scrape_target_id_started_at_idx" ON "scrape_on_demand_runs"("tenant_id", "scrape_target_id", "started_at");

-- AddForeignKey
ALTER TABLE "scrape_on_demand_states" ADD CONSTRAINT "scrape_on_demand_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_on_demand_states" ADD CONSTRAINT "scrape_on_demand_states_scrape_target_id_fkey" FOREIGN KEY ("scrape_target_id") REFERENCES "scrape_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_on_demand_runs" ADD CONSTRAINT "scrape_on_demand_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_on_demand_runs" ADD CONSTRAINT "scrape_on_demand_runs_scrape_target_id_fkey" FOREIGN KEY ("scrape_target_id") REFERENCES "scrape_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
