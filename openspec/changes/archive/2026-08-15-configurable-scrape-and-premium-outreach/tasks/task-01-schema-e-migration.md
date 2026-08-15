# Task 1 — Schema e migration

**Change:** `configurable-scrape-and-premium-outreach`
**Grupo:** 1 de 8
**Pré-requisitos:** nenhum
**Desbloqueia:** [2](./task-02-captura-identidade-upsert-e-catalogo.md), [3](./task-03-notifly-knobs-de-envio-e-filtro-website.md), [5](./task-05-admin-campos-novos-de-outreach.md), [6](./task-06-admin-api-de-scrape-targets-e-coverage.md)

## Objetivo do grupo

Persistir no PostgreSQL a identidade do lead por cidade, knobs de envio no outreach, e o catálogo/cobertura de scrape, com migration e backfill aplicáveis.

## Contexto para o subagent

- Schema: `prisma/schema.prisma` (PostgreSQL, Prisma 6). Convenção: `@@map` snake_case; `@map` em colunas.
- `Lead` hoje: `phone String @unique`, **sem** `cityId`. `City` / `Neighborhood` já existem (`@@map("cities")` / `neighborhoods`).
- `TenantOutreachConfig` já existe (`@@map("tenant_outreach_configs")`).
- Não alterar `WhatsappAccount`, `TenantLead.messageId`, Baileys, welcome.
- Relação: adicionar em `City` as inversas `leads`, `scrapeTargets`, `scrapeCoverages`.
- Comandos: `npx prisma validate`, `npx prisma migrate dev`, `npx prisma generate`.
- Leads existentes na operação atual são de Pindamonhangaba — backfill obrigatório **antes** de NOT NULL + unique composto.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_*/migration.sql` | criar |

---

## 1.1 — Identidade do Lead (phone + city)

### O que fazer

Em `model Lead`:

- Adicionar `cityId Int @map("city_id")` e `city City @relation(fields: [cityId], references: [id])`.
- Adicionar `categories String[]` (PostgreSQL `TEXT[]`).
- Remover `@unique` de `phone`.
- Adicionar `@@unique([phone, cityId])`.

Em `model City`, relation `leads Lead[]`.

Manter `category String` (categoria primária / última vista).

### Critérios de aceite

- [ ] `npx prisma validate` passa
- [ ] `phone` não é mais unique sozinho
- [ ] Unique composto `(phone, cityId)` existe

### Não fazer

- Não unique `(phone, cityId, category)`
- Não apagar a coluna `category`
- Não adicionar `neighborhoodId` no Lead

---

## 1.2 — Knobs em TenantOutreachConfig

### O que fazer

Em `model TenantOutreachConfig` adicionar:

```prisma
leadsPerRun         Int     @default(5) @map("leads_per_run")
headerImageUrl      String? @map("header_image_url")
sendIntervalSeconds Int     @default(5) @map("send_interval_seconds")
```

### Critérios de aceite

- [ ] Campos no schema com defaults 5 / null / 5
- [ ] Colunas snake_case via `@map`

### Não fazer

- Não remover `schedule`, `categories`, templates, pricing

---

## 1.3 — ScrapeTarget e ScrapeCoverage

### O que fazer

```prisma
model ScrapeTarget {
  id        Int      @id @default(autoincrement())
  cityId    Int      @map("city_id")
  city      City     @relation(fields: [cityId], references: [id])
  category  String
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([cityId, category])
  @@map("scrape_targets")
}

model ScrapeCoverage {
  id            Int      @id @default(autoincrement())
  cityId        Int      @map("city_id")
  city          City     @relation(fields: [cityId], references: [id])
  category      String
  firstRunAt    DateTime @map("first_run_at")
  lastRunAt     DateTime @map("last_run_at")
  lastStatus    String   @map("last_status")
  lastLeadCount Int?     @map("last_lead_count")

  @@unique([cityId, category])
  @@map("scrape_coverages")
}
```

`lastStatus` valores usados depois: `success` | `partial` | `failed` (String, sem enum obrigatório).

Relations em `City`: `scrapeTargets ScrapeTarget[]`, `scrapeCoverages ScrapeCoverage[]`.

### Critérios de aceite

- [ ] Unique `(cityId, category)` nas duas tabelas
- [ ] `@@map` snake_case

### Não fazer

- Não fundir Target e Coverage num único model
- Não adicionar `nextRunAt` / política de rotação

---

## 1.4 — Migration e backfill

### O que fazer

Gerar migration Prisma. O SQL (ajustado na migration se o generate não fizer o backfill) DEVE:

1. `INSERT` cidade `Pindamonhangaba` se não existir (`cities.name`).
2. Adicionar `leads.city_id` **nullable**, backfill todos os leads para o `id` dessa cidade, depois `SET NOT NULL` + FK.
3. `leads.categories TEXT[] NOT NULL DEFAULT '{}'`; `UPDATE leads SET categories = ARRAY[category] WHERE category IS NOT NULL AND (categories = '{}' OR categories IS NULL)`.
4. `DROP` unique de `leads.phone`; `CREATE UNIQUE` `(phone, city_id)`.
5. Colunas novas em `tenant_outreach_configs` com defaults.
6. `CREATE TABLE` scrape_targets / scrape_coverages.

Rodar `npx prisma generate`.

Se `migrate dev` pedir nome, usar algo como `lead_city_scrape_catalog_outreach_knobs`.

### Critérios de aceite

- [ ] Migration aplica em banco vazio e em banco com leads existentes (backfill)
- [ ] Client Prisma gerado inclui os novos campos/models
- [ ] `npx prisma validate` ok

### Não fazer

- Não dropar a tabela `leads`
- Não forçar unique de `phone` de volta
- Não seed de ScrapeTarget nesta task (grupo 2)

---

## Verificação do grupo

- `npx prisma validate`
- Inspecionar `schema.prisma`: Lead tem `cityId` + `categories` + `@@unique([phone, cityId])`
- Migration contém backfill de Pindamonhangaba

## Handoff para próxima task

Captura e notifly podem assumir `Lead.cityId`, unique composto, `categories[]`, knobs no outreach, e models de scrape. Seed de target fica no grupo 2.
