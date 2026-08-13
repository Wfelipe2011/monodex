-- Backfill city for existing operational leads (Pindamonhangaba) before NOT NULL + composite unique.
INSERT INTO "cities" ("name")
SELECT 'Pindamonhangaba'
WHERE NOT EXISTS (
    SELECT 1 FROM "cities" WHERE "name" = 'Pindamonhangaba'
);

-- AlterTable: city_id nullable, backfill, then NOT NULL + FK
ALTER TABLE "leads" ADD COLUMN "city_id" INTEGER;

UPDATE "leads"
SET "city_id" = (SELECT "id" FROM "cities" WHERE "name" = 'Pindamonhangaba' LIMIT 1)
WHERE "city_id" IS NULL;

ALTER TABLE "leads" ALTER COLUMN "city_id" SET NOT NULL;

ALTER TABLE "leads" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "leads"
SET "categories" = ARRAY["category"]
WHERE "category" IS NOT NULL AND ("categories" = '{}' OR "categories" IS NULL);

-- DropIndex
DROP INDEX "leads_phone_key";

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_city_id_key" ON "leads"("phone", "city_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: outreach knobs
ALTER TABLE "tenant_outreach_configs" ADD COLUMN "leads_per_run" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "tenant_outreach_configs" ADD COLUMN "header_image_url" TEXT;
ALTER TABLE "tenant_outreach_configs" ADD COLUMN "send_interval_seconds" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "scrape_targets" (
    "id" SERIAL NOT NULL,
    "city_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrape_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_coverages" (
    "id" SERIAL NOT NULL,
    "city_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "first_run_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3) NOT NULL,
    "last_status" TEXT NOT NULL,
    "last_lead_count" INTEGER,

    CONSTRAINT "scrape_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scrape_targets_city_id_category_key" ON "scrape_targets"("city_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "scrape_coverages_city_id_category_key" ON "scrape_coverages"("city_id", "category");

-- AddForeignKey
ALTER TABLE "scrape_targets" ADD CONSTRAINT "scrape_targets_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_coverages" ADD CONSTRAINT "scrape_coverages_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
