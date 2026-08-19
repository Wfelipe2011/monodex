-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN "last_status" "WhatsappDeliveryStatus";

-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN "template_name" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenant_leads_message_id_key" ON "tenant_leads"("message_id");

-- AlterTable
ALTER TABLE "whatsapp_send_statuses" ADD COLUMN "tenant_lead_id" INTEGER;

-- AddForeignKey
ALTER TABLE "whatsapp_send_statuses" ADD CONSTRAINT "whatsapp_send_statuses_tenant_lead_id_fkey" FOREIGN KEY ("tenant_lead_id") REFERENCES "tenant_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: attach orphan send statuses (no list_send_id) to city tenant leads by wamid = message_id.
-- Does not invent template_name. Does not touch rows that already have list_send_id.
UPDATE whatsapp_send_statuses s
SET tenant_lead_id = tl.id
FROM tenant_leads tl
WHERE s.list_send_id IS NULL
  AND tl.message_id IS NOT NULL
  AND s.wamid = tl.message_id;

-- Backfill: snapshot latest delivery status onto tenant_leads.last_status (template_name stays NULL).
UPDATE tenant_leads tl
SET last_status = latest.status
FROM (
  SELECT DISTINCT ON (wamid) wamid, status
  FROM whatsapp_send_statuses
  ORDER BY wamid, meta_timestamp DESC
) latest
WHERE tl.message_id = latest.wamid;
