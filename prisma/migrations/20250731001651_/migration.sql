/*
  Warnings:

  - You are about to alter the column `amount` on the `coin_transactions` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `balance` on the `coins` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.

*/
-- AlterTable
ALTER TABLE "coin_transactions" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "coins" ALTER COLUMN "balance" SET DATA TYPE DOUBLE PRECISION;
