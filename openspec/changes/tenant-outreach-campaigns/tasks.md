| Group | Detail file |
|-------|-------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-shared-policy-e-phone-exclusion.md](./tasks/task-02-shared-policy-e-phone-exclusion.md) |
| 3 | [task-03-notifly-runs-e-contactleads-por-campanha.md](./tasks/task-03-notifly-runs-e-contactleads-por-campanha.md) |
| 4 | [task-04-gym-ctrl-config-e-crud-de-campanhas.md](./tasks/task-04-gym-ctrl-config-e-crud-de-campanhas.md) |
| 5 | [task-05-gym-ctrl-leituras-operacionais.md](./tasks/task-05-gym-ctrl-leituras-operacionais.md) |
| 6 | [task-06-postman-front-integration-e-verificacao.md](./tasks/task-06-postman-front-integration-e-verificacao.md) |

**Execution order:** 1 → 2 → (3 ∥ 4 after 2) → 5 → 6 (3 and 4 can run in parallel once 1–2 are done)

**Context artifacts:** [proposal.md](./proposal.md) · [design.md](./design.md) · [specs](./specs/)

## 1. Schema e migration

📄 [Details](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar model `TenantOutreachCampaign`, FKs em `OutreachSendRun` e `TenantLead`, unique `(tenantId, leadId)`
- [x] 1.2 Migration: backfill campanha **Padrão** a partir de `TenantOutreachConfig` e remover colunas migradas do config

## 2. Shared — policy e phone exclusion

📄 [Details](./tasks/task-02-shared-policy-e-phone-exclusion.md)

- [x] 2.1 Helper de validação `cityId` da campanha vs `TenantSendPolicy`
- [x] 2.2 Atualizar `cityUsedPhonesWhere` / comentários para lock permanente (inclui failed com `messageId`)

## 3. Notifly — runs e contactLeads por campanha

📄 [Details](./tasks/task-03-notifly-runs-e-contactleads-por-campanha.md)

- [x] 3.1 `OutreachSendRunService.openCityRun` por `outreachCampaignId`
- [x] 3.2 Refatorar cron e `contactLeads` para campanha (schedule, categories, templates, cityId)
- [x] 3.3 Notify afirmativo e persistência com `outreachCampaignId`; upsert `TenantLead`
- [x] 3.4 Webhook: não setar `contacted=false` em failed de pool; quota refill alinhado

## 4. Gym-ctrl — config e CRUD de campanhas

📄 [Details](./tasks/task-04-gym-ctrl-config-e-crud-de-campanhas.md)

- [x] 4.1 Slim `OutreachConfigService`/DTOs (master + pricing; sem schedule/templates)
- [x] 4.2 `OutreachCampaignsController` + service + DTOs/Swagger em `/tenant/:tenantId/outreach-campaigns`

## 5. Gym-ctrl — leituras operacionais

📄 [Details](./tasks/task-05-gym-ctrl-leituras-operacionais.md)

- [x] 5.1 Filtro `outreachCampaignId` em outreach sends + campos campaign na resposta
- [x] 5.2 Conversations: `prospecting`, query `q` / `outreachCampaignId` / `templateName`
- [x] 5.3 Home ops: `sends.byOutreachCampaign`

## 6. Postman, FRONT-INTEGRATION e verificação

📄 [Details](./tasks/task-06-postman-front-integration-e-verificacao.md)

- [x] 6.1 Atualizar Postman e seed se necessário
- [x] 6.2 Criar `FRONT-INTEGRATION.md` (Campanhas de prospecção, filtros, breaking config)
- [x] 6.3 Testes unitários críticos e checklist de verificação manual
