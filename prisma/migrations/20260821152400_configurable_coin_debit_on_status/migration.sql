-- CreateEnum
CREATE TYPE "CoinDebitOnStatus" AS ENUM ('sent', 'delivered', 'read');

-- AlterTable
ALTER TABLE "tenant_outreach_configs" ADD COLUMN "coin_debit_on_status" "CoinDebitOnStatus" NOT NULL DEFAULT 'delivered';

-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN "coin_debited_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN "coin_refunded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_list_sends" ADD COLUMN "coin_debited_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_list_sends" ADD COLUMN "coin_refunded_at" TIMESTAMP(3);
