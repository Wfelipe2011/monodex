-- AlterEnum
ALTER TYPE "Roles" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
