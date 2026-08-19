| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-notifly-snapshot-no-contactleads.md](./tasks/task-02-notifly-snapshot-no-contactleads.md) |
| 3 | [task-03-notifly-webhook-de-cidade.md](./tasks/task-03-notifly-webhook-de-cidade.md) |
| 4 | [task-04-admin-api-de-listagem.md](./tasks/task-04-admin-api-de-listagem.md) |
| 5 | [task-05-postman-front-integration-e-verificacao.md](./tasks/task-05-postman-front-integration-e-verificacao.md) |

**Ordem de execução:** 1 → (2 ∥ 3 ∥ 4) → 5

Grupos 2, 3 e 4 só precisam do schema. Grupo 5 espera snapshot, webhook e API.

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar `lastStatus` e `templateName` em `TenantLead`, unique em `messageId`, e `tenantLeadId` opcional em `WhatsappSendStatus`
- [x] 1.2 Migration SQL com backfill de `tenant_lead_id` e `last_status`; gerar client Prisma

## 2. Notifly — snapshot no contactLeads

📄 [Detalhes](./tasks/task-02-notifly-snapshot-no-contactleads.md)

- [x] 2.1 Gravar `templateName` (nome do catálogo) no `tenantLead.create` de cidade; `lastStatus` permanece null

## 3. Notifly — webhook de cidade

📄 [Detalhes](./tasks/task-03-notifly-webhook-de-cidade.md)

- [x] 3.1 `handleStatus`: correlacionar `TenantLead.messageId`, setar `tenantLeadId`, atualizar `lastStatus`; não mexer em lock de lista
- [x] 3.2 Testes de `handleStatus` (cidade vs lista vs órfão)

## 4. Admin — API de listagem

📄 [Detalhes](./tasks/task-04-admin-api-de-listagem.md)

- [x] 4.1 `GET /tenant/:tenantId/outreach/sends` e `GET /platform/tenants/:tenantId/outreach/sends` com filtro `status=failed`, `latestError` e payload de lead + template
- [x] 4.2 Testes do service (exclui `messageId` null e `TenantListSend`; 404 tenant)

## 5. Postman, FRONT-INTEGRATION e verificação

📄 [Detalhes](./tasks/task-05-postman-front-integration-e-verificacao.md)

- [x] 5.1 Requests Postman nos folders Tenant e Platform Outreach
- [x] 5.2 `FRONT-INTEGRATION.md` para o PWA (paths, shape, polling)
- [x] 5.3 `npx prisma validate` e checklist de isolamento lista vs cidade
