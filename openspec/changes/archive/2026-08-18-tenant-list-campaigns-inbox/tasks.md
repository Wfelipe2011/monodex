| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-shared-recipient-bindings-e-helpers.md](./tasks/task-02-shared-recipient-bindings-e-helpers.md) |
| 3 | [task-03-admin-listas-e-leads.md](./tasks/task-03-admin-listas-e-leads.md) |
| 4 | [task-04-admin-campanhas.md](./tasks/task-04-admin-campanhas.md) |
| 5 | [task-05-notifly-webhook-messages-e-statuses.md](./tasks/task-05-notifly-webhook-messages-e-statuses.md) |
| 6 | [task-06-notifly-cron-campanhas-e-reply-actions.md](./tasks/task-06-notifly-cron-campanhas-e-reply-actions.md) |
| 7 | [task-07-admin-api-de-conversa.md](./tasks/task-07-admin-api-de-conversa.md) |
| 8 | [task-08-seed-postman-e-verificacao.md](./tasks/task-08-seed-postman-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → (3 ∥ 5) → 4 → 6 → 7 → 8

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar modelos `TenantLeadList`, `TenantListLead`, `TenantListCampaign`, `TenantListSend`, `WhatsappConversationMessage`, `WhatsappSendStatus` e enums; unique phone por lista; gerar migration Prisma

## 2. Shared — recipient bindings e helpers

📄 [Detalhes](./tasks/task-02-shared-recipient-bindings-e-helpers.md)

- [x] 2.1 Estender `BINDING_TYPES` e `resolveBindingValue` com `recipient.*`; testes em `whatsapp-template.spec.ts`
- [x] 2.2 Helper de normalização de telefone/categoria e extração de labels QUICK_REPLY de `components` Meta

## 3. Admin — listas e leads

📄 [Detalhes](./tasks/task-03-admin-listas-e-leads.md)

- [x] 3.1 CRUD `TenantLeadList` e `TenantListLead` (`SUPER_ADMIN`) com validação de telefone único por lista
- [x] 3.2 Import CSV + download de planilha exemplo + endpoint de sugestões de categoria

## 4. Admin — campanhas

📄 [Detalhes](./tasks/task-04-admin-campanhas.md)

- [x] 4.1 CRUD campanhas com template, bindings `send`/`notify`, schedule, `buttonActions`, validação enable
- [x] 4.2 Listagem de sends com filtro `status=failed` e agregação de último status

## 5. Notifly — webhook messages e statuses

📄 [Detalhes](./tasks/task-05-notifly-webhook-messages-e-statuses.md)

- [x] 5.1 Refatorar `POST /response-leads`: iterar entries, persistir inbound em `WhatsappConversationMessage`, optional chaining
- [x] 5.2 Persistir `WhatsappSendStatus`, unlock de lead em `failed`, correlacionar `wamid`/`context.id`

## 6. Notifly — cron de campanhas e reply actions

📄 [Detalhes](./tasks/task-06-notifly-cron-campanhas-e-reply-actions.md)

- [x] 6.1 `ListCampaignsService`: cron horário, lote, intervalo, débito coin, lock de lead, outbound message + send row
- [x] 6.2 Handler de botão NOTIFY/NOOP para sends de lista (sem cashback); texto livre só inbox

## 7. Admin — API de conversa

📄 [Detalhes](./tasks/task-07-admin-api-de-conversa.md)

- [x] 7.1 `GET/POST .../leads/:leadId/messages` com janela 24h Meta e gravação outbound Cloud API text

## 8. Seed, Postman e verificação

📄 [Detalhes](./tasks/task-08-seed-postman-e-verificacao.md)

- [x] 8.1 Seed demo opcional, requests Postman, checklist manual (import → campanha → webhook → inbox → failed unlock)
