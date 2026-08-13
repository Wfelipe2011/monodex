| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-captura-identidade-upsert-e-catalogo.md](./tasks/task-02-captura-identidade-upsert-e-catalogo.md) |
| 3 | [task-03-notifly-knobs-de-envio-e-filtro-website.md](./tasks/task-03-notifly-knobs-de-envio-e-filtro-website.md) |
| 4 | [task-04-notifly-mix-premium-e-dedup-de-phone.md](./tasks/task-04-notifly-mix-premium-e-dedup-de-phone.md) |
| 5 | [task-05-admin-campos-novos-de-outreach.md](./tasks/task-05-admin-campos-novos-de-outreach.md) |
| 6 | [task-06-admin-api-de-scrape-targets-e-coverage.md](./tasks/task-06-admin-api-de-scrape-targets-e-coverage.md) |
| 7 | [task-07-postman-seeds-e-contratos.md](./tasks/task-07-postman-seeds-e-contratos.md) |
| 8 | [task-08-verificacao-e-handoff.md](./tasks/task-08-verificacao-e-handoff.md) |

**Ordem de execução:** 1 → (2 ∥ 3 ∥ 5 ∥ 6) → 4 (depois de 3) → 7 (depois de 5 e 6) → 8.

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar `Lead.cityId` (FK `City`), `Lead.categories` (`String[]`), unique composto `(phone, cityId)` e remover unique global de `phone`
- [x] 1.2 Adicionar `leadsPerRun`, `headerImageUrl` e `sendIntervalSeconds` em `TenantOutreachConfig` com defaults 5 / null / 5
- [x] 1.3 Criar models `ScrapeTarget` e `ScrapeCoverage` com unique `(cityId, category)`
- [x] 1.4 Migration com backfill: cidade Pindamonhangaba, `city_id` em leads existentes, `categories = ARRAY[category]`, gerar client

## 2. Captura — identidade, upsert e catálogo

📄 [Detalhes](./tasks/task-02-captura-identidade-upsert-e-catalogo.md)

- [x] 2.1 Substituir skip-if-exists por upsert `(phone, cityId)` com união de `categories`; não ressuscitar `deletedAt`
- [x] 2.2 Remover `SCRAPE_CITY`, `SCRAPE_CATEGORIES` e o cron one-shot 20:00; cron 06:00 ler `ScrapeTarget` enabled agrupado por cidade
- [x] 2.3 Garantir bairros por cidade (neighborhood scraper existente) e gravar/atualizar `ScrapeCoverage` por par cidade×categoria (sucesso, partial, failed)
- [x] 2.4 Seed mínimo: `ScrapeTarget` enabled Pindamonhangaba + `Construtoras` (comportamento atual do const)

## 3. Notifly — knobs de envio e filtro website

📄 [Detalhes](./tasks/task-03-notifly-knobs-de-envio-e-filtro-website.md)

- [x] 3.1 Remover o filtro `OR` de `website` em `contactLeads`; manter filtro intencional de phone `153`
- [x] 3.2 Usar `leadsPerRun` capado por `floor(saldo / costPerLead)` no lugar de `slice(0, 5)`
- [x] 3.3 Header image: `config.headerImageUrl` com fallback `WHATSAPP_OUTREACH_HEADER_IMAGE_URL`
- [x] 3.4 Esperar `sendIntervalSeconds` entre envios do tenant (e antes do próximo tenant no mesmo tick)

## 4. Notifly — mix premium e dedup de phone

📄 [Detalhes](./tasks/task-04-notifly-mix-premium-e-dedup-de-phone.md)

- [x] 4.1 Elegibilidade por interseção `Lead.categories` (fallback `category`) com `config.categories`
- [x] 4.2 Excluir phones já presentes em `TenantLead` do tenant (qualquer cidade) e deduplicar o lote por `phone`
- [x] 4.3 Implementar classificador premium (round rating, reviews 0/null→1, média global da categoria, réguas 5%/10%)
- [x] 4.4 Montar lote estratificado `X`/`Y` (D4 do design), shuffle final, um `TenantLead` só no `leadId` enviado

## 5. Admin — campos novos de outreach

📄 [Detalhes](./tasks/task-05-admin-campos-novos-de-outreach.md)

- [x] 5.1 Estender PUT/PATCH DTOs e `OutreachConfigService` com `leadsPerRun`, `headerImageUrl`, `sendIntervalSeconds` e validações
- [x] 5.2 GET devolver os três campos; PUT omitidos usam defaults 5 / null / 5

## 6. Admin — API de scrape targets e coverage

📄 [Detalhes](./tasks/task-06-admin-api-de-scrape-targets-e-coverage.md)

- [x] 6.1 CRUD `POST/GET /admin/scrape-targets` e `GET/PATCH/DELETE /admin/scrape-targets/:id` (upsert city+category, SUPER_ADMIN)
- [x] 6.2 `GET /admin/scrape-coverages` somente leitura
- [x] 6.3 Registrar controllers/services no `AdminModule`; create de target NÃO dispara Puppeteer

## 7. Postman, seeds e contratos

📄 [Detalhes](./tasks/task-07-postman-seeds-e-contratos.md)

- [x] 7.1 Atualizar `prisma/seed-outreach.ts` com defaults dos knobs novos (sem sobrescrever se já existirem, ou setar 5/5)
- [x] 7.2 Atualizar `postman/monodex.postman_collection.json`: outreach bodies + pasta Scrape Targets/Coverage

## 8. Verificação e handoff

📄 [Detalhes](./tasks/task-08-verificacao-e-handoff.md)

- [x] 8.1 Grep: nenhum `findUnique({ phone })` em Lead; nenhum `SCRAPE_CATEGORIES` / `slice(0, 5)` no notifly; website OR-filter ausente em `contactLeads`
- [x] 8.2 `npx prisma validate`; checklist manual: upsert scrape, dois phones iguais em cidades distintas, lote com mix, intervalo 5s, admin targets
