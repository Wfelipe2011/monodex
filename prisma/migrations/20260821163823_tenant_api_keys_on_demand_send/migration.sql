-- CreateEnum
CREATE TYPE "OnDemandSendSource" AS ENUM ('ADMIN_JWT', 'API_KEY', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "OnDemandScheduleStatus" AS ENUM ('PENDING', 'CANCELLED', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformJobKey" ADD VALUE 'ORPHAN_MEDIA_CLEANUP';
ALTER TYPE "PlatformJobKey" ADD VALUE 'ON_DEMAND_SCHEDULE_RUN';

-- AlterTable
ALTER TABLE "tenant_outreach_configs" ADD COLUMN     "cost_per_on_demand_send" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "api_access_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "whatsapp_send_statuses" ADD COLUMN     "on_demand_send_id" INTEGER;

-- CreateTable
CREATE TABLE "tenant_api_keys" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_media" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_on_demand_sends" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "wamid" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "media_id" INTEGER,
    "source" "OnDemandSendSource" NOT NULL,
    "api_key_id" INTEGER,
    "schedule_id" INTEGER,
    "last_status" "WhatsappDeliveryStatus",
    "coin_debited_at" TIMESTAMP(3),
    "coin_refunded_at" TIMESTAMP(3),
    "conversation_id" INTEGER,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_on_demand_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_on_demand_schedules" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "variables" JSONB NOT NULL,
    "media_id" INTEGER,
    "lead_id" INTEGER,
    "status" "OnDemandScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "failed_reason" TEXT,
    "on_demand_send_id" INTEGER,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_on_demand_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_api_keys_key_hash_key" ON "tenant_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "tenant_api_keys_tenant_id_revoked_at_idx" ON "tenant_api_keys"("tenant_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_media_public_id_key" ON "tenant_media"("public_id");

-- CreateIndex
CREATE INDEX "tenant_media_tenant_id_created_at_idx" ON "tenant_media"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_on_demand_sends_wamid_key" ON "tenant_on_demand_sends"("wamid");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_on_demand_sends_schedule_id_key" ON "tenant_on_demand_sends"("schedule_id");

-- CreateIndex
CREATE INDEX "tenant_on_demand_sends_tenant_id_sent_at_idx" ON "tenant_on_demand_sends"("tenant_id", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_on_demand_schedules_on_demand_send_id_key" ON "tenant_on_demand_schedules"("on_demand_send_id");

-- CreateIndex
CREATE INDEX "tenant_on_demand_schedules_status_scheduled_for_idx" ON "tenant_on_demand_schedules"("status", "scheduled_for");

-- AddForeignKey
ALTER TABLE "whatsapp_send_statuses" ADD CONSTRAINT "whatsapp_send_statuses_on_demand_send_id_fkey" FOREIGN KEY ("on_demand_send_id") REFERENCES "tenant_on_demand_sends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_api_keys" ADD CONSTRAINT "tenant_api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_media" ADD CONSTRAINT "tenant_media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_sends" ADD CONSTRAINT "tenant_on_demand_sends_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_sends" ADD CONSTRAINT "tenant_on_demand_sends_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_sends" ADD CONSTRAINT "tenant_on_demand_sends_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "tenant_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_sends" ADD CONSTRAINT "tenant_on_demand_sends_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "tenant_api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_sends" ADD CONSTRAINT "tenant_on_demand_sends_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "tenant_on_demand_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_sends" ADD CONSTRAINT "tenant_on_demand_sends_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_schedules" ADD CONSTRAINT "tenant_on_demand_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_schedules" ADD CONSTRAINT "tenant_on_demand_schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_schedules" ADD CONSTRAINT "tenant_on_demand_schedules_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "tenant_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_on_demand_schedules" ADD CONSTRAINT "tenant_on_demand_schedules_on_demand_send_id_fkey" FOREIGN KEY ("on_demand_send_id") REFERENCES "tenant_on_demand_sends"("id") ON DELETE SET NULL ON UPDATE CASCADE;
