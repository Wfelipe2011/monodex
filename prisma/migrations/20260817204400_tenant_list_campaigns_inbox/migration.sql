-- CreateEnum
CREATE TYPE "WhatsappConversationDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "WhatsappDeliveryStatus" AS ENUM ('sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "ListCampaignButtonAction" AS ENUM ('NOTIFY', 'NOOP');

-- CreateTable
CREATE TABLE "tenant_lead_lists" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cost_per_send" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_lead_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_list_leads" (
    "id" SERIAL NOT NULL,
    "list_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "category" TEXT,
    "reviews" INTEGER,
    "send_lock_campaign_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_list_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_list_campaigns" (
    "id" SERIAL NOT NULL,
    "list_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "template_id" INTEGER NOT NULL,
    "slot_bindings" JSONB NOT NULL DEFAULT '{}',
    "notify_template_id" INTEGER,
    "notify_slot_bindings" JSONB NOT NULL DEFAULT '{}',
    "button_actions" JSONB NOT NULL DEFAULT '[]',
    "schedule" JSONB NOT NULL,
    "sends_per_run" INTEGER NOT NULL DEFAULT 5,
    "send_interval_seconds" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_list_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_list_sends" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "list_lead_id" INTEGER NOT NULL,
    "wamid" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_status" "WhatsappDeliveryStatus",

    CONSTRAINT "tenant_list_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversation_messages" (
    "id" SERIAL NOT NULL,
    "wamid" TEXT NOT NULL,
    "direction" "WhatsappConversationDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "raw" JSONB NOT NULL,
    "phone" TEXT NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "list_lead_id" INTEGER,
    "list_send_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_send_statuses" (
    "id" SERIAL NOT NULL,
    "wamid" TEXT NOT NULL,
    "status" "WhatsappDeliveryStatus" NOT NULL,
    "meta_timestamp" TIMESTAMP(3) NOT NULL,
    "recipient_id" TEXT,
    "errors" JSONB,
    "list_send_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_send_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_list_leads_list_id_phone_key" ON "tenant_list_leads"("list_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_list_sends_wamid_key" ON "tenant_list_sends"("wamid");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversation_messages_wamid_key" ON "whatsapp_conversation_messages"("wamid");

-- CreateIndex
CREATE INDEX "whatsapp_conversation_messages_list_lead_id_created_at_idx" ON "whatsapp_conversation_messages"("list_lead_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_send_statuses_wamid_meta_timestamp_idx" ON "whatsapp_send_statuses"("wamid", "meta_timestamp");

-- AddForeignKey
ALTER TABLE "tenant_lead_lists" ADD CONSTRAINT "tenant_lead_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_leads" ADD CONSTRAINT "tenant_list_leads_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "tenant_lead_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_leads" ADD CONSTRAINT "tenant_list_leads_send_lock_campaign_id_fkey" FOREIGN KEY ("send_lock_campaign_id") REFERENCES "tenant_list_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_campaigns" ADD CONSTRAINT "tenant_list_campaigns_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "tenant_lead_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_campaigns" ADD CONSTRAINT "tenant_list_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_campaigns" ADD CONSTRAINT "tenant_list_campaigns_notify_template_id_fkey" FOREIGN KEY ("notify_template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_sends" ADD CONSTRAINT "tenant_list_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "tenant_list_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_list_sends" ADD CONSTRAINT "tenant_list_sends_list_lead_id_fkey" FOREIGN KEY ("list_lead_id") REFERENCES "tenant_list_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_messages" ADD CONSTRAINT "whatsapp_conversation_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_messages" ADD CONSTRAINT "whatsapp_conversation_messages_list_lead_id_fkey" FOREIGN KEY ("list_lead_id") REFERENCES "tenant_list_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversation_messages" ADD CONSTRAINT "whatsapp_conversation_messages_list_send_id_fkey" FOREIGN KEY ("list_send_id") REFERENCES "tenant_list_sends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_send_statuses" ADD CONSTRAINT "whatsapp_send_statuses_list_send_id_fkey" FOREIGN KEY ("list_send_id") REFERENCES "tenant_list_sends"("id") ON DELETE SET NULL ON UPDATE CASCADE;
