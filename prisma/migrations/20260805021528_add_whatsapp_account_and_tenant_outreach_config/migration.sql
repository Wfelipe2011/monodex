-- CreateEnum
CREATE TYPE "WhatsappProvider" AS ENUM ('CLOUD_API');

-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" SERIAL NOT NULL,
    "provider" "WhatsappProvider" NOT NULL DEFAULT 'CLOUD_API',
    "phone_number_id" TEXT NOT NULL,
    "display_phone" TEXT,
    "token_env_key" TEXT NOT NULL DEFAULT 'WHATSAPP_TOKEN',
    "tenant_id" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_outreach_configs" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cost_per_lead" DOUBLE PRECISION NOT NULL,
    "cashback_on_reply" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outreach_template_name" TEXT NOT NULL,
    "notify_tenant_template_name" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "categories" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_outreach_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_outreach_configs_tenant_id_key" ON "tenant_outreach_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_outreach_configs" ADD CONSTRAINT "tenant_outreach_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
