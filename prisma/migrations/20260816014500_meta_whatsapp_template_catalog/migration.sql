-- CreateEnum
CREATE TYPE "PlatformJobKey" AS ENUM ('WHATSAPP_TEMPLATE_SYNC', 'SCRAPE');

-- AlterTable: drop flat template/header/text columns; add FKs + slot_bindings
-- Existing rows get slot_bindings = '{}' (NOT NULL default).
ALTER TABLE "tenant_outreach_configs" DROP COLUMN "header_image_url",
DROP COLUMN "notify_tenant_template_name",
DROP COLUMN "outreach_contact_text",
DROP COLUMN "outreach_template_name",
ADD COLUMN     "notify_template_id" INTEGER,
ADD COLUMN     "outreach_template_id" INTEGER,
ADD COLUMN     "slot_bindings" JSONB NOT NULL DEFAULT '{}';

-- waba_id is required. Existing WhatsappAccount rows have no WABA in DB.
-- WHATSAPP_WABA_ID is not a Prisma migration input; fill existing rows with ''
-- then drop the default. Seed/PATCH must replace empty values with the real WABA.
ALTER TABLE "whatsapp_accounts" ADD COLUMN "waba_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "whatsapp_accounts" ALTER COLUMN "waba_id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "whatsapp_message_templates" (
    "id" SERIAL NOT NULL,
    "whatsapp_account_id" INTEGER NOT NULL,
    "meta_id" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT,
    "parameter_format" TEXT,
    "components" JSONB NOT NULL,
    "slots" JSONB NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_job_schedules" (
    "id" SERIAL NOT NULL,
    "job_key" "PlatformJobKey" NOT NULL,
    "cron_expression" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_job_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_message_templates_whatsapp_account_id_name_languag_key" ON "whatsapp_message_templates"("whatsapp_account_id", "name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "platform_job_schedules_job_key_key" ON "platform_job_schedules"("job_key");

-- AddForeignKey
ALTER TABLE "whatsapp_message_templates" ADD CONSTRAINT "whatsapp_message_templates_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_outreach_configs" ADD CONSTRAINT "tenant_outreach_configs_outreach_template_id_fkey" FOREIGN KEY ("outreach_template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_outreach_configs" ADD CONSTRAINT "tenant_outreach_configs_notify_template_id_fkey" FOREIGN KEY ("notify_template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default platform job schedules (sync 05:00, scrape 06:00 America/Sao_Paulo)
INSERT INTO "platform_job_schedules" ("job_key", "cron_expression", "time_zone", "enabled", "created_at", "updated_at")
VALUES
  ('WHATSAPP_TEMPLATE_SYNC', '0 5 * * *', 'America/Sao_Paulo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('SCRAPE', '0 6 * * *', 'America/Sao_Paulo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
