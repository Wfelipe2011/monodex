| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-gym-ctrl-web-push-service-e-env.md](./tasks/task-02-gym-ctrl-web-push-service-e-env.md) |
| 3 | [task-03-gym-ctrl-api-de-subscriptions.md](./tasks/task-03-gym-ctrl-api-de-subscriptions.md) |
| 4 | [task-04-gym-ctrl-hook-publish-inbound-e-leadname.md](./tasks/task-04-gym-ctrl-hook-publish-inbound-e-leadname.md) |
| 5 | [task-05-documentacao-front-e-verificacao.md](./tasks/task-05-documentacao-front-e-verificacao.md) |

**Ordem de execução:** 1 → (2 ∥ 3) → 4 → 5

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar modelo `PushSubscription` (userId, endpoint unique, p256dh, auth, userAgent opcional); relation em `User`; gerar migration Prisma

## 2. gym-ctrl — Web Push service e env

📄 [Detalhes](./tasks/task-02-gym-ctrl-web-push-service-e-env.md)

- [x] 2.1 Dependência `web-push`; Joi `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; `InboxWebPushService` com setVapidDetails e send
- [x] 2.2 Montar título/corpo/tag e resolver audiência (tenant + SUPER_ADMIN); skip se WS OPEN; cleanup 410

## 3. gym-ctrl — API de subscriptions

📄 [Detalhes](./tasks/task-03-gym-ctrl-api-de-subscriptions.md)

- [x] 3.1 `PUT/DELETE /admin/push-subscriptions` autenticados; upsert/delete por endpoint

## 4. gym-ctrl + notifly — Hook publishInbound e leadName

📄 [Detalhes](./tasks/task-04-gym-ctrl-hook-publish-inbound-e-leadname.md)

- [x] 4.1 Gateway/Service: rastrear `userId` nas conexões WS; `hasOpenConnection(userId)`
- [x] 4.2 `publishInbound` chama web push; DTO interno + notifly incluem `leadName`

## 5. Documentação front e verificação

📄 [Detalhes](./tasks/task-05-documentacao-front-e-verificacao.md)

- [x] 5.1 `PUSH-INTEGRATION.md`: SW, subscribe, handlers, supressão, tag WhatsApp-style
- [x] 5.2 Postman + checklist manual (subscription + push simulado)
