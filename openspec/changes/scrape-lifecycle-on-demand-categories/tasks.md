| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-shared-categorias-e-lifecycle.md](./tasks/task-02-shared-categorias-e-lifecycle.md) |
| 3 | [task-03-captura-lifecycle-planned.md](./tasks/task-03-captura-lifecycle-planned.md) |
| 4 | [task-04-captura-on-demand-cursor.md](./tasks/task-04-captura-on-demand-cursor.md) |
| 5 | [task-05-gym-ctrl-on-demand-e-coverage.md](./tasks/task-05-gym-ctrl-on-demand-e-coverage.md) |
| 6 | [task-06-gym-ctrl-outreach-categorias.md](./tasks/task-06-gym-ctrl-outreach-categorias.md) |
| 7 | [task-07-postman-front-e-verificacao.md](./tasks/task-07-postman-front-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → 3 → 4 → (5 ∥ 6) → 7

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Estender `ScrapeCoverage` com `schedulePhase`, `nextScheduledRunAt`, `scheduledRunCount`, opcional `lastRunKind` (`planned` | `on_demand`)
- [x] 1.2 Criar `ScrapeOnDemandState` (unique `tenantId` + `scrapeTargetId`, cursor, `onDemandEnabled`) e `ScrapeOnDemandRun` (log + quota)
- [x] 1.3 Migration backfill: fases a partir de coverage existente; jitter opcional em `nextScheduledRunAt`
- [x] 1.4 Gerar Prisma client e validar `npx prisma validate`

## 2. Shared — categorias elegíveis e helpers de lifecycle

📄 [Detalhes](./tasks/task-02-shared-categorias-e-lifecycle.md)

- [x] 2.1 Helper `eligibleOutreachCategories(tenantId)` em `@core/shared` (send policy + enabled targets)
- [x] 2.2 Helper `isScheduledScrapeEligible(coverage, now)` e constantes 90d/180d
- [x] 2.3 Testes unitários dos helpers

## 3. Captura — lifecycle planned e capacidade comercial

📄 [Detalhes](./tasks/task-03-captura-lifecycle-planned.md)

- [x] 3.1 Selecionar targets elegíveis no `handleMorningScrape` (não mais todos enabled)
- [x] 3.2 Avançar fase após planned run com base em `lastLeadCount`
- [x] 3.3 Limite K pares 08h–18h America/Sao_Paulo; env `SCRAPE_BUSINESS_HOURS_MAX_TARGETS`
- [x] 3.4 Lock por `(cityId, category)` além do mutex global

## 4. Captura — on-demand curto e cursor

📄 [Detalhes](./tasks/task-04-captura-on-demand-cursor.md)

- [x] 4.1 Endpoint interno autenticado `POST /internal/scrape/on-demand`
- [x] 4.2 Modo short no scraper: N bairros a partir do cursor, uma categoria
- [x] 4.3 Atualizar cursor e gravar `ScrapeOnDemandRun`; não alterar `nextScheduledRunAt`
- [x] 4.4 Testes e2e/unit do fluxo short

## 5. Gym-ctrl — on-demand tenant e coverage enriquecida

📄 [Detalhes](./tasks/task-05-gym-ctrl-on-demand-e-coverage.md)

- [x] 5.1 POST/GET/PATCH on-demand em `tenant-scrape-targets` controller
- [x] 5.2 Quota 2/dia e validação link + send policy + 409 lock
- [x] 5.3 Estender listagem coverage platform com phase e next run

## 6. Gym-ctrl — outreach categorias restritas

📄 [Detalhes](./tasks/task-06-gym-ctrl-outreach-categorias.md)

- [x] 6.1 GET `eligible-categories` no tenant outreach config
- [x] 6.2 Validar `categories` em PUT/PATCH tenant; bypass regras city-filter só na rota platform super-admin conforme spec
- [x] 6.3 Testes `OutreachConfigService` para reject/accept

## 7. Postman, FRONT-INTEGRATION e verificação

📄 [Detalhes](./tasks/task-07-postman-front-e-verificacao.md)

- [x] 7.1 Atualizar Postman: on-demand, eligible categories, coverage fields
- [x] 7.2 Snippet FRONT-INTEGRATION (breaking categories + on-demand UX)
- [x] 7.3 Checklist manual: lifecycle bootstrap→90d→180d, quota on-demand, cursor, cap horário comercial
