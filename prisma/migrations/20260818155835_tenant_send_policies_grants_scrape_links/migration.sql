-- CreateTable
CREATE TABLE "tenant_send_policies" (
    "tenant_id" INTEGER NOT NULL,
    "allowed_city_ids" JSONB NOT NULL DEFAULT '[]',
    "denied_city_ids" JSONB NOT NULL DEFAULT '[]',
    "respect_all_tenants" BOOLEAN NOT NULL DEFAULT false,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_send_policies_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "tenant_respects" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "respected_tenant_id" INTEGER NOT NULL,

    CONSTRAINT "tenant_respects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template_grants" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_template_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_scrape_targets" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "scrape_target_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_scrape_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_respects_tenant_id_respected_tenant_id_key" ON "tenant_respects"("tenant_id", "respected_tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_template_grants_tenant_id_template_id_key" ON "tenant_template_grants"("tenant_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_scrape_targets_tenant_id_scrape_target_id_key" ON "tenant_scrape_targets"("tenant_id", "scrape_target_id");

-- AddForeignKey
ALTER TABLE "tenant_send_policies" ADD CONSTRAINT "tenant_send_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_respects" ADD CONSTRAINT "tenant_respects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_respects" ADD CONSTRAINT "tenant_respects_respected_tenant_id_fkey" FOREIGN KEY ("respected_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template_grants" ADD CONSTRAINT "tenant_template_grants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template_grants" ADD CONSTRAINT "tenant_template_grants_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "whatsapp_message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_scrape_targets" ADD CONSTRAINT "tenant_scrape_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_scrape_targets" ADD CONSTRAINT "tenant_scrape_targets_scrape_target_id_fkey" FOREIGN KEY ("scrape_target_id") REFERENCES "scrape_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
