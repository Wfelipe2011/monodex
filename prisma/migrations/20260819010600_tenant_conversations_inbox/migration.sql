-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "last_inbound_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "whatsapp_conversation_messages" ADD COLUMN "conversation_id" INTEGER;

-- Backfill: one thread per distinct (tenant_id, phone) already present in messages.
-- display_name: TenantListLead.name when the latest message has list_lead_id; otherwise phone.
-- Does not invent threads without messages.
INSERT INTO "whatsapp_conversations" (
    "tenant_id",
    "phone",
    "display_name",
    "last_inbound_at",
    "last_message_at",
    "created_at",
    "updated_at"
)
SELECT
    agg."tenant_id",
    agg."phone",
    CASE
        WHEN latest."list_lead_id" IS NOT NULL THEN COALESCE(ll."name", agg."phone")
        ELSE agg."phone"
    END,
    agg."last_inbound_at",
    agg."last_message_at",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        "tenant_id",
        "phone",
        MAX("created_at") AS "last_message_at",
        MAX("created_at") FILTER (WHERE "direction" = 'IN') AS "last_inbound_at"
    FROM "whatsapp_conversation_messages"
    GROUP BY "tenant_id", "phone"
) agg
INNER JOIN LATERAL (
    SELECT "list_lead_id"
    FROM "whatsapp_conversation_messages" m
    WHERE m."tenant_id" = agg."tenant_id"
      AND m."phone" = agg."phone"
    ORDER BY m."created_at" DESC, m."id" DESC
    LIMIT 1
) latest ON TRUE
LEFT JOIN "tenant_list_leads" ll ON ll."id" = latest."list_lead_id";

-- Backfill: attach existing messages to the thread of the same (tenant_id, phone).
UPDATE "whatsapp_conversation_messages" m
SET "conversation_id" = c."id"
FROM "whatsapp_conversations" c
WHERE c."tenant_id" = m."tenant_id"
  AND c."phone" = m."phone";

-- AlterTable
ALTER TABLE "whatsapp_conversation_messages" ALTER COLUMN "conversation_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversations_tenant_id_phone_key" ON "whatsapp_conversations"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "whatsapp_conversations_tenant_id_last_message_at_idx" ON "whatsapp_conversations"("tenant_id", "last_message_at");

-- CreateIndex
CREATE INDEX "whatsapp_conversation_messages_conversation_id_created_at_idx" ON "whatsapp_conversation_messages"("conversation_id", "created_at");

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_messages" ADD CONSTRAINT "whatsapp_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
