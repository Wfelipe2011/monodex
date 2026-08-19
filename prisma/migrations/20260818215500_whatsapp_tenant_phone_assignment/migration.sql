-- AlterTable
ALTER TABLE "whatsapp_accounts" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_accounts_phone_number_id_key" ON "whatsapp_accounts"("phone_number_id");

-- AlterTable
ALTER TABLE "tenant_outreach_configs" ADD COLUMN "whatsapp_account_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "tenant_outreach_configs_whatsapp_account_id_key" ON "tenant_outreach_configs"("whatsapp_account_id");

-- AddForeignKey
ALTER TABLE "tenant_outreach_configs" ADD CONSTRAINT "tenant_outreach_configs_whatsapp_account_id_fkey" FOREIGN KEY ("whatsapp_account_id") REFERENCES "whatsapp_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: oldest enabled platform account becomes the single default (before unique partial).
UPDATE whatsapp_accounts
SET is_default = true
WHERE id = (
  SELECT id FROM whatsapp_accounts
  WHERE tenant_id IS NULL AND enabled = true
  ORDER BY id ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM whatsapp_accounts WHERE is_default = true
);

-- Exactly one default account
CREATE UNIQUE INDEX whatsapp_accounts_one_default
  ON whatsapp_accounts (is_default)
  WHERE is_default = true;
