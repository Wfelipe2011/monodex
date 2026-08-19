| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-shared-telefone-nome-e-gate-dedicado.md](./tasks/task-02-shared-telefone-nome-e-gate-dedicado.md) |
| 3 | [task-03-notifly-thread-no-webhook-e-nos-templates.md](./tasks/task-03-notifly-thread-no-webhook-e-nos-templates.md) |
| 4 | [task-04-admin-api-de-conversas.md](./tasks/task-04-admin-api-de-conversas.md) |
| 5 | [task-05-admin-websocket-e-web-push.md](./tasks/task-05-admin-websocket-e-web-push.md) |
| 6 | [task-06-admin-test-send-e-home-do-tenant.md](./tasks/task-06-admin-test-send-e-home-do-tenant.md) |
| 7 | [task-07-postman-front-integration-e-verificacao.md](./tasks/task-07-postman-front-integration-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → (3 ∥ 4 ∥ 6) → 5 → 7

Grupo 2 pode começar junto com 1 (helpers puros). Grupo 5 espera o contrato de persistência/notify da 3. Grupo 7 espera 3–6.

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar `WhatsappConversation` e `conversationId` em `WhatsappConversationMessage`; migration com backfill por `(tenantId, phone)`
- [x] 1.2 `npx prisma validate` e gerar client

## 2. Shared — telefone, nome e gate dedicado

📄 [Detalhes](./tasks/task-02-shared-telefone-nome-e-gate-dedicado.md)

- [x] 2.1 Helper de `displayName` (profile.name vs phone) e predicado de conta dedicada amarrada ao tenant

## 3. Notifly — thread no webhook e nos templates

📄 [Detalhes](./tasks/task-03-notifly-thread-no-webhook-e-nos-templates.md)

- [x] 3.1 Inbound: upsert thread no número dedicado, `contacts` para nome, persistir `IN` com `conversationId`
- [x] 3.2 Outbound template na thread: campanha de lista ao lead e `contactLeads` ao lead; não gravar notify de `Tenant.phone`
- [x] 3.3 Notify interno só com `conversationId`; payload `displayName` (sem `listId`/`leadId`)
- [x] 3.4 Testes de persistência inbound (dedicado, default, frio, cidade, lista) e de skip de notify

## 4. Admin — API de conversas

📄 [Detalhes](./tasks/task-04-admin-api-de-conversas.md)

- [x] 4.1 `GET /tenant/:tenantId/conversations` e `GET/POST .../conversations/:id/messages`; remover API de mensagens de lista
- [x] 4.2 Testes: janela 24h, Super Admin GET ok / POST 403, 400 sem número dedicado, Graph no FROM dedicado

## 5. Admin — WebSocket e web push

📄 [Detalhes](./tasks/task-05-admin-websocket-e-web-push.md)

- [x] 5.1 DTO interno e `publishInbound` com `conversationId` + `displayName`
- [x] 5.2 Push: `tag` `inbox-conversation-{id}`, `data.url` `/tenant/{tenantId}/conversations/{conversationId}`

## 6. Admin — test-send e home do tenant

📄 [Detalhes](./tasks/task-06-admin-test-send-e-home-do-tenant.md)

- [x] 6.1 Test-send em conta dedicada amarrada: upsert thread + `OUT` template; default não grava conversa
- [x] 6.2 `GET /tenant/:tenantId/ops/home` (coins, funil, `hasDedicatedNumber`, inbox, sends hoje/ontem em `America/Sao_Paulo`)
- [x] 6.3 Testes de home (cidade+lista, captura excluída, timezone) e de test-send

## 7. Postman, FRONT-INTEGRATION e verificação

📄 [Detalhes](./tasks/task-07-postman-front-integration-e-verificacao.md)

- [x] 7.1 Substituir requests de mensagens de lista por conversas; adicionar home
- [x] 7.2 `FRONT-INTEGRATION.md` (REST, WS, push, home, breaking)
- [x] 7.3 `npx prisma validate` e checklist: default não abre inbox; notify `Tenant.phone` fora da thread
