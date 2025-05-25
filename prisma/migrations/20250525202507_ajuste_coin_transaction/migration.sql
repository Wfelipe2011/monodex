/*
  Warnings:

  - Added the required column `tenant_id` to the `coin_transactions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `coin_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('CREDITO', 'DEBITO', 'TRANSFERENCIA', 'BONUS');

-- AlterTable
ALTER TABLE "coin_transactions" ADD COLUMN     "tenant_id" INTEGER NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "CoinTransactionType" NOT NULL;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
