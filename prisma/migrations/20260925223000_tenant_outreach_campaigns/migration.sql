-- CreateTable
CREATE TABLE "tenant_outreach_campaigns" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" JSONB NOT NULL,
    "categories" JSONB NOT NULL,
    "leads_per_run" INTEGER NOT NULL DEFAULT 5,
    "send_interval_seconds" INTEGER NOT NULL DEFAULT 5,
    "outreach_template_id" INTEGER,
    "notify_template_id" INTEGER,
    "slot_bindings" JSONB NOT NULL DEFAULT '{}',
    "city_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_outreach_campaigns_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "outreach_send_runs" ADD COLUMN "outreach_campaign_id" INTEGER;

-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN "outreach_campaign_id" INTEGER;

-- Dedupe tenant_leads (keep row with message_id, else highest id) before unique (tenant_id, lead_id)
WITH survivors AS (
    SELECT DISTINCT ON ("tenant_id", "lead_id") "id" AS "keep_id", "tenant_id", "lead_id"
    FROM "tenant_leads"
    ORDER BY "tenant_id", "lead_id", ("message_id" IS NOT NULL) DESC, "id" DESC
)
UPDATE "user_leads" ul
SET "tenant_lead_id" = s."keep_id"
FROM "tenant_leads" tl
JOIN survivors s ON s."tenant_id" = tl."tenant_id" AND s."lead_id" = tl."lead_id"
WHERE ul."tenant_lead_id" = tl."id" AND tl."id" <> s."keep_id";

WITH survivors AS (
    SELECT DISTINCT ON ("tenant_id", "lead_id") "id" AS "keep_id", "tenant_id", "lead_id"
    FROM "tenant_leads"
    ORDER BY "tenant_id", "lead_id", ("message_id" IS NOT NULL) DESC, "id" DESC
)
UPDATE "whatsapp_send_statuses" wss
SET "tenant_lead_id" = s."keep_id"
FROM "tenant_leads" tl
JOIN survivors s ON s."tenant_id" = tl."tenant_id" AND s."lead_id" = tl."lead_id"
WHERE wss."tenant_lead_id" = tl."id" AND tl."id" <> s."keep_id";

DELETE FROM "tenant_leads" tl
WHERE tl."id" NOT IN (
    SELECT DISTINCT ON ("tenant_id", "lead_id") "id"
    FROM "tenant_leads"
    ORDER BY "tenant_id", "lead_id", ("message_id" IS NOT NULL) DESC, "id" DESC
);

-- Backfill campanha Padrão from tenant_outreach_configs
INSERT INTO "tenant_outreach_campaigns" (
    "tenant_id",
    "name",
    "enabled",
    "schedule",
    "categories",
    "leads_per_run",
    "send_interval_seconds",
    "outreach_template_id",
    "notify_template_id",
    "slot_bindings",
    "city_id",
    "created_at",
    "updated_at"
)
SELECT
    c."tenant_id",
    'Padrão',
    c."enabled",
    c."schedule",
    c."categories",
    c."leads_per_run",
    c."send_interval_seconds",
    c."outreach_template_id",
    c."notify_template_id",
    c."slot_bindings",
    NULL,
    c."created_at",
    c."updated_at"
FROM "tenant_outreach_configs" c;

-- Backfill tenant_leads.outreach_campaign_id for sent pool leads
UPDATE "tenant_leads" tl
SET "outreach_campaign_id" = oc."id"
FROM "tenant_outreach_campaigns" oc
WHERE oc."tenant_id" = tl."tenant_id"
  AND oc."name" = 'Padrão'
  AND tl."message_id" IS NOT NULL;

-- Backfill historical CITY runs without list campaign_id
UPDATE "outreach_send_runs" r
SET "outreach_campaign_id" = oc."id"
FROM "tenant_outreach_campaigns" oc
WHERE oc."tenant_id" = r."tenant_id"
  AND oc."name" = 'Padrão'
  AND r."channel" = 'CITY'
  AND r."campaign_id" IS NULL;

-- DropForeignKey
ALTER TABLE "tenant_outreach_configs" DROP CONSTRAINT "tenant_outreach_configs_outreach_template_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_outreach_configs" DROP CONSTRAINT "tenant_outreach_configs_notify_template_id_fkey";

-- AlterTable
ALTER TABLE "tenant_outreach_configs" DROP COLUMN "schedule",
DROP COLUMN "categories",
DROP COLUMN "leads_per_run",
DROP COLUMN "send_interval_seconds",
DROP COLUMN "outreach_template_id",
DROP COLUMN "notify_template_id",
DROP COLUMN "slot_bindings";

-- CreateIndex
CREATE UNIQUE INDEX "tenant_leads_tenant_id_lead_id_key" ON "tenant_leads"("tenant_id", "lead_id");

-- CreateIndex
CREATE INDEX "tenant_leads_outreach_campaign_id_idx" ON "tenant_leads"("outreach_campaign_id");

-- CreateIndex
CREATE INDEX "outreach_send_runs_outreach_campaign_id_status_idx" ON "outreach_send_runs"("outreach_campaign_id", "status");

-- AddForeignKey
ALTER TABLE "tenant_outreach_campaigns" ADD CONSTRAINT "tenant_outreach_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_outreach_campaigns" ADD CONSTRAINT "tenant_outreach_campaigns_outreach_template_id_fkey" FOREIGN KEY ("outreach_template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_outreach_campaigns" ADD CONSTRAINT "tenant_outreach_campaigns_notify_template_id_fkey" FOREIGN KEY ("notify_template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_outreach_campaigns" ADD CONSTRAINT "tenant_outreach_campaigns_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_send_runs" ADD CONSTRAINT "outreach_send_runs_outreach_campaign_id_fkey" FOREIGN KEY ("outreach_campaign_id") REFERENCES "tenant_outreach_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_leads" ADD CONSTRAINT "tenant_leads_outreach_campaign_id_fkey" FOREIGN KEY ("outreach_campaign_id") REFERENCES "tenant_outreach_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
