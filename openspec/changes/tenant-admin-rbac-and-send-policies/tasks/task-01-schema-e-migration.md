# Task 1 — Schema e migration

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 1 de 8
**Pré-requisitos:** nenhum
**Desbloqueia:** [Task 2](./task-02-guards-e-helpers-de-autorizacao.md) e grupos de API (3–6)

## Objetivo do grupo

Persistir política de envio, grants de template e vínculos de scrape sem quebrar `ScrapeTarget` único em `(cityId, category)`.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`.
- `Tenant` já tem `active`, `outreachConfig`, `whatsappAccounts`, `leadLists`.
- `WhatsappMessageTemplate` em ~linha 308; `ScrapeTarget` `@@unique([cityId, category])` em ~linha 371.
- `TenantOutreachConfig` permanece 1:1; **não** colocar allow/deny como colunas nela (design D5).
- Seed de referência: `prisma/seed-outreach.ts`, `prisma/seed-platform-admin.ts`.
- Não alterar gym-ctrl/notifly/captura neste grupo além do client Prisma gerado.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_tenant_send_policies_grants_scrape_links/migration.sql` | criar |
| `prisma/seed-outreach.ts` ou seed pequeno de policy | editar opcional |

---

## 1.1 — Models Prisma

### O que fazer

Adicionar:

```prisma
model TenantSendPolicy {
  tenantId            Int      @id @map("tenant_id")
  tenant              Tenant   @relation(fields: [tenantId], references: [id])
  allowedCityIds      Json     @default("[]") @map("allowed_city_ids")
  deniedCityIds       Json     @default("[]") @map("denied_city_ids")
  respectAllTenants   Boolean  @default(false) @map("respect_all_tenants")
  exclusive           Boolean  @default(false)
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@map("tenant_send_policies")
}

model TenantRespect {
  id                 Int    @id @default(autoincrement())
  tenantId           Int    @map("tenant_id")
  tenant             Tenant @relation("RespectingTenant", fields: [tenantId], references: [id])
  respectedTenantId  Int    @map("respected_tenant_id")
  respectedTenant    Tenant @relation("RespectedTenant", fields: [respectedTenantId], references: [id])

  @@unique([tenantId, respectedTenantId])
  @@map("tenant_respects")
}

model TenantTemplateGrant {
  id         Int                     @id @default(autoincrement())
  tenantId   Int                     @map("tenant_id")
  tenant     Tenant                  @relation(fields: [tenantId], references: [id])
  templateId Int                     @map("template_id")
  template   WhatsappMessageTemplate @relation(fields: [templateId], references: [id])
  createdAt  DateTime                @default(now()) @map("created_at")

  @@unique([tenantId, templateId])
  @@map("tenant_template_grants")
}

model TenantScrapeTarget {
  id             Int          @id @default(autoincrement())
  tenantId       Int          @map("tenant_id")
  tenant         Tenant       @relation(fields: [tenantId], references: [id])
  scrapeTargetId Int          @map("scrape_target_id")
  scrapeTarget   ScrapeTarget @relation(fields: [scrapeTargetId], references: [id])
  createdAt      DateTime     @default(now()) @map("created_at")

  @@unique([tenantId, scrapeTargetId])
  @@map("tenant_scrape_targets")
}
```

Em `Tenant`, adicionar arrays de relation correspondentes (`sendPolicy`, `respecting`, `respectedBy`, `templateGrants`, `scrapeTargets`). Em `WhatsappMessageTemplate` e `ScrapeTarget`, o inverso.

Rejeitar `tenantId == respectedTenantId` na API (grupo 5), não precisa de check SQL se documentado.

### Critérios de aceite

- [ ] Models e `@@unique` existem no schema
- [ ] `TenantOutreachConfig` não ganhou colunas de cidade/exclusividade

### Não fazer

- Não duplicar `ScrapeTarget` por tenant
- Não tornar `costPerLead` opcional neste grupo

---

## 1.2 — Relations em Tenant / template / scrape

### O que fazer

Atualizar `model Tenant`, `WhatsappMessageTemplate`, `ScrapeTarget` com os campos de relation. `onDelete`: preferir `Restrict` em template/scrape para não apagar grant órfão sem 409 na API depois.

### Critérios de aceite

- [ ] `prisma validate` passa
- [ ] Relação 1:1 `TenantSendPolicy` via `tenantId` PK

### Não fazer

- Não mudar `Lead @@unique([phone, cityId])`

---

## 1.3 — Migration

### O que fazer

```bash
npx prisma migrate dev --name tenant_send_policies_grants_scrape_links
```

Gerar client.

### Critérios de aceite

- [ ] Pasta nova em `prisma/migrations/`
- [ ] Client gera tipos `TenantSendPolicy`, `TenantRespect`, `TenantTemplateGrant`, `TenantScrapeTarget`

### Não fazer

- Não editar migrations já aplicadas

---

## 1.4 — Seed de policy vazia

### O que fazer

No seed de outreach (`prisma/seed-outreach.ts`) ou script idempotente: para cada `Tenant` sem `TenantSendPolicy`, criar row com `allowedCityIds: []`, `deniedCityIds: []`, `respectAllTenants: false`, `exclusive: false`. Não criar grants nem scrape links automaticamente.

### Critérios de aceite

- [ ] Re-rodar seed não duplica policy (upsert por `tenantId`)

### Não fazer

- Não resetar `TenantOutreachConfig` existente
- Não grantar todos os templates

---

## Verificação do grupo

`npx prisma validate` + migrate aplicada. Schema contém os quatro models.

## Handoff para próxima task

Prisma Client tipado. Grupo 2 pode importar os tipos. Grupos 3–6 escrevem APIs em cima desses models.
