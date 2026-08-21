| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-shared-hash-de-chave-e-authguard-dual-mode.md](./tasks/task-02-shared-hash-de-chave-e-authguard-dual-mode.md) |
| 3 | [task-03-admin-grant-chaves-e-preco-on-demand.md](./tasks/task-03-admin-grant-chaves-e-preco-on-demand.md) |
| 4 | [task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md](./tasks/task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md) |
| 5 | [task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md](./tasks/task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md) |
| 6 | [task-06-notifly-billing-on-demand-webhook-e-reserva-unificada.md](./tasks/task-06-notifly-billing-on-demand-webhook-e-reserva-unificada.md) |
| 7 | [task-07-agendas-api-e-worker-horario.md](./tasks/task-07-agendas-api-e-worker-horario.md) |
| 8 | [task-08-postman-front-integration-e-verificacao.md](./tasks/task-08-postman-front-integration-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → (3 ∥ 4) → 5 → 6 → 7 → 8. Grupo 6 pode começar o helper de reserva após 1, mas o webhook on-demand precisa do send do 5.

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · [specs/](./specs/)

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar `apiAccessEnabled` em `Tenant` (default false) e `costPerOnDemandSend` em `TenantOutreachConfig` (default 0)
- [x] 1.2 Criar models `TenantApiKey`, `TenantMedia`, `TenantOnDemandSend`, `TenantOnDemandSchedule` e enums de source/status
- [x] 1.3 Ligar `WhatsappSendStatus.onDemandSendId` e estender `PlatformJobKey` com `ORPHAN_MEDIA_CLEANUP` e `ON_DEMAND_SCHEDULE_RUN`
- [x] 1.4 Gerar migration Prisma, seed dos novos jobs + defaults de outreach, gitignore da pasta `uploads/`

## 2. Shared — hash de chave e AuthGuard dual-mode

📄 [Detalhes](./tasks/task-02-shared-hash-de-chave-e-authguard-dual-mode.md)

- [x] 2.1 Helpers de gerar/hashear `X-API-KEY` (SHA-256, prefixo display) colocalizados no shared
- [x] 2.2 Estender `UserToken` / request com `authKind` e `apiKeyId`; AuthGuard aceita JWT **ou** `X-API-KEY` (ambos juntos = 400)
- [x] 2.3 Decorator de allowlist; chave válida fora da allowlist ou em `/platform/*` = 401; CORS inclui `X-API-KEY`
- [x] 2.4 Testes do hash, do guard (chave válida/revogada/grant off/rota fora) e do conflito JWT+chave

## 3. Admin — grant, chaves e preço on-demand

📄 [Detalhes](./tasks/task-03-admin-grant-chaves-e-preco-on-demand.md)

- [x] 3.1 Super Admin PATCH `apiAccessEnabled` em `/platform/tenants/:id`; Admin não persiste o campo
- [x] 3.2 CRUD `/tenant/:tenantId/api-keys` (create 201 com plaintext uma vez, list sem secret, revoke); teto 3 ativas; Super Admin só GET
- [x] 3.3 Super Admin PATCH `costPerOnDemandSend` no outreach-config platform; Admin GET vê / PATCH 403; default 0
- [x] 3.4 Testes de service/controller dos três fluxos acima

## 4. Mídia — upload, listagem, GET público e cron de órfãos

📄 [Detalhes](./tasks/task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md)

- [x] 4.1 POST multipart e GET list `/tenant/:tenantId/media` (Admin JWT ou API key; Super Admin GET only); MIME e 5 MB
- [x] 4.2 `GET /public/media/:publicId` `@Public()` devolvendo bytes; URL absoluta via `PUBLIC_API_BASE_URL`
- [x] 4.3 Job `ORPHAN_MEDIA_CLEANUP` no gym-ctrl (poll + CronJob, default `0 3 1,16 * *`) apagando arquivos sem row
- [x] 4.4 Testes de upload/list/escopo, GET público 200/404 e cleanup órfão vs referenciado

## 5. Gym-ctrl — send on-demand e dual-auth nas rotas existentes

📄 [Detalhes](./tasks/task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md)

- [x] 5.1 POST `/tenant/:tenantId/whatsapp-templates/:templateId/sends` (gates: grant, APPROVED, dedicado, preço > 0, saldo disponível, slots + `imageId`); Super Admin 403
- [x] 5.2 Persistir `TenantOnDemandSend` sem debitar coins; upsert thread `OUT template` no número dedicado
- [x] 5.3 GET list/by-id de on-demand sends (`lastStatus`); allowlist em GET templates granted e GET/POST conversations
- [x] 5.4 Testes: send ok, Super Admin 403, sem dedicado, template ungranted, header sem imagem, Graph 200 sem débito

## 6. Notifly — billing on-demand, webhook e reserva unificada

📄 [Detalhes](./tasks/task-06-notifly-billing-on-demand-webhook-e-reserva-unificada.md)

- [x] 6.1 Resolver `wamid` → `TenantOnDemandSend` no webhook; gravar `WhatsappSendStatus.onDemandSendId` (XOR com cidade/lista)
- [x] 6.2 Estender `CoinDebitOnStatusService` com débito/estorno idempotente usando `costPerOnDemandSend`
- [x] 6.3 Reserva unificada (`pendingCity*costPerLead + pendingList*costPerSend + pendingOnDemand*costPerOnDemandSend`) nos crons de cidade/lista e no preflight do send
- [x] 6.4 Testes do serviço, webhook on-demand e reserva cruzada

## 7. Agendas — API e worker horário

📄 [Detalhes](./tasks/task-07-agendas-api-e-worker-horario.md)

- [x] 7.1 CRUD `/tenant/:tenantId/on-demand-schedules` (create data+hora SP, list, GET, cancel PENDING); Super Admin só lê; passado = 400
- [x] 7.2 Worker `ON_DEMAND_SCHEDULE_RUN` no notifly (default `0 * * * *`): claim `PENDING` due, mesmo pipeline do send, `source=SCHEDULE`
- [x] 7.3 Preflight na hora H (inativo, grant, APPROVED, dedicado, mídia, preço, saldo) → `FAILED` sem Graph e sem débito
- [x] 7.4 Testes de create/cancel, skip futuro, fire sucesso, falha de preflight sem cobrança, claim concorrente

## 8. Postman, FRONT-INTEGRATION e verificação

📄 [Detalhes](./tasks/task-08-postman-front-integration-e-verificacao.md)

- [x] 8.1 Swagger (ApiSecurity `X-API-KEY`, DTOs, tags) + coleção Postman dos fluxos chave/send/mídia/agenda
- [x] 8.2 `FRONT-INTEGRATION.md` desta change (grant, preço, chaves, upload, disparo, agenda, inbox via chave, Super Admin read-only)
- [x] 8.3 Seed mínimo + checklist E2E (chave allowlist/fora, send+status B, conversa C, órfão, agenda fail sem débito)
