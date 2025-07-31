/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "tenant_leads" ADD COLUMN     "message_id" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_phone_key" ON "tenants"("phone");
