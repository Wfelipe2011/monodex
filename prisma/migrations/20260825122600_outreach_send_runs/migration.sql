-- CreateEnum
CREATE TYPE "OutreachSendRunChannel" AS ENUM ('CITY', 'LIST');

-- CreateEnum
CREATE TYPE "OutreachSendRunStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "OutreachSendRunClosedReason" AS ENUM ('TARGET_MET', 'ATTEMPT_CAP', 'EXHAUSTED', 'TTL', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "outreach_send_runs" (
    "id" SERIAL NOT NULL,
    "channel" "OutreachSendRunChannel" NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "campaign_id" INTEGER,
    "target_count" INTEGER NOT NULL,
    "try_count" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "charged_count" INTEGER NOT NULL DEFAULT 0,
    "status" "OutreachSendRunStatus" NOT NULL DEFAULT 'OPEN',
    "closed_reason" "OutreachSendRunClosedReason",
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_send_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN "run_id" INTEGER,
ADD COLUMN "refill_triggered_at" TIMESTAMP(3),
ADD COLUMN "was_premium" BOOLEAN;

-- AlterTable
ALTER TABLE "tenant_list_sends" ADD COLUMN "run_id" INTEGER,
ADD COLUMN "refill_triggered_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "outreach_send_runs_tenant_id_channel_status_idx" ON "outreach_send_runs"("tenant_id", "channel", "status");

-- CreateIndex
CREATE INDEX "outreach_send_runs_campaign_id_status_idx" ON "outreach_send_runs"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "outreach_send_runs_expires_at_idx" ON "outreach_send_runs"("expires_at");

-- CreateIndex
CREATE INDEX "tenant_leads_run_id_idx" ON "tenant_leads"("run_id");

-- CreateIndex
CREATE INDEX "tenant_list_sends_run_id_idx" ON "tenant_list_sends"("run_id");

-- AddForeignKey
ALTER TABLE "outreach_send_runs" ADD CONSTRAINT "outreach_send_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_send_runs" ADD CONSTRAINT "outreach_send_runs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "tenant_list_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_leads" ADD CONSTRAINT "tenant_leads_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "outreach_send_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_sends" ADD CONSTRAINT "tenant_list_sends_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "outreach_send_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
