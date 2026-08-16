| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-shared-slots-bindings-e-payload-graph.md](./tasks/task-02-shared-slots-bindings-e-payload-graph.md) |
| 3 | [task-03-admin-whatsapp-account-e-job-schedules.md](./tasks/task-03-admin-whatsapp-account-e-job-schedules.md) |
| 4 | [task-04-admin-catalogo-sync-e-teste.md](./tasks/task-04-admin-catalogo-sync-e-teste.md) |
| 5 | [task-05-admin-outreach-config-breaking.md](./tasks/task-05-admin-outreach-config-breaking.md) |
| 6 | [task-06-notifly-send-generico-e-cron-de-sync.md](./tasks/task-06-notifly-send-generico-e-cron-de-sync.md) |
| 7 | [task-07-captura-scrape-schedule-dinamico.md](./tasks/task-07-captura-scrape-schedule-dinamico.md) |
| 8 | [task-08-seed-postman-e-verificacao.md](./tasks/task-08-seed-postman-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → (3 ∥ 5 ∥ 7) → 4 (depois de 2 e 3) → 6 (depois de 2) → 8

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar `wabaId` em `WhatsappAccount`; model `WhatsappMessageTemplate`; FKs e `slotBindings` em `TenantOutreachConfig`; remover colunas flat de template/texto/header
- [x] 1.2 Adicionar `PlatformJobKey` + `PlatformJobSchedule`; gerar migration e client Prisma

## 2. Shared — slots, bindings e payload Graph

📄 [Detalhes](./tasks/task-02-shared-slots-bindings-e-payload-graph.md)

- [x] 2.1 Parser de `components` Meta → `slots` com keys estáveis
- [x] 2.2 Resolver de bindings (`literal`, `header_image`, `lead.*`, `tenant.phone`, `now.*`) com formatação pt-BR
- [x] 2.3 Builder de `template.components` Graph a partir de slots + valores

## 3. Admin — WhatsApp account e job schedules

📄 [Detalhes](./tasks/task-03-admin-whatsapp-account-e-job-schedules.md)

- [x] 3.1 DTOs e persistência de `wabaId` em create/list/get/patch de contas plataforma
- [x] 3.2 `GET/PUT /admin/platform-job-schedules/:jobKey` SUPER_ADMIN com validação de cron

## 4. Admin — catálogo, sync e teste

📄 [Detalhes](./tasks/task-04-admin-catalogo-sync-e-teste.md)

- [x] 4.1 `POST /admin/whatsapp-templates/sync` e `GET /admin/whatsapp-templates` (slots na resposta)
- [x] 4.2 `POST /admin/whatsapp-templates/:id/test` SUPER_ADMIN: `to` + `variables` + `leadId` opcional; sem TenantLead/coin

## 5. Admin — outreach config breaking

📄 [Detalhes](./tasks/task-05-admin-outreach-config-breaking.md)

- [x] 5.1 Substituir DTOs PUT/PATCH: template ids + `slotBindings`; rejeitar campos legado
- [x] 5.2 `assertEnableAllowed` exige templates APPROVED e slots cobertos

## 6. Notifly — send genérico e cron de sync

📄 [Detalhes](./tasks/task-06-notifly-send-generico-e-cron-de-sync.md)

- [x] 6.1 `contactLeads` e `responseLeads` usam catálogo + bindings; sem env de header/notify copy; language da row
- [x] 6.2 Cron dinâmico `WHATSAPP_TEMPLATE_SYNC` (poll 60s) + mesmo upsert do sync admin

## 7. Captura — scrape schedule dinâmico

📄 [Detalhes](./tasks/task-07-captura-scrape-schedule-dinamico.md)

- [x] 7.1 Remover `@Cron('0 6 * * *')`; registrar job a partir de `PlatformJobSchedule` `SCRAPE` com poll 60s

## 8. Seed, Postman e verificação

📄 [Detalhes](./tasks/task-08-seed-postman-e-verificacao.md)

- [x] 8.1 Seed: `wabaId`, schedules default, outreach via FKs/bindings (sync Graph opcional, não falhar sem Meta)
- [x] 8.2 Atualizar Postman: accounts, templates, schedules, outreach breaking
- [x] 8.3 `npx prisma validate`; grep campos removidos no runtime admin/notifly
