| Grupo | Arquivo de detalhes |
|-------|---------------------|
| 1 | [task-01-schema-e-migration.md](./tasks/task-01-schema-e-migration.md) |
| 2 | [task-02-resolver-de-credenciais.md](./tasks/task-02-resolver-de-credenciais.md) |
| 3 | [task-03-admin-whatsapp-accounts.md](./tasks/task-03-admin-whatsapp-accounts.md) |
| 4 | [task-04-admin-amarracao-no-outreach-config.md](./tasks/task-04-admin-amarracao-no-outreach-config.md) |
| 5 | [task-05-notifly-envios-por-tenant.md](./tasks/task-05-notifly-envios-por-tenant.md) |
| 6 | [task-06-inbox-e-webhook.md](./tasks/task-06-inbox-e-webhook.md) |
| 7 | [task-07-catalogo-sync-na-default.md](./tasks/task-07-catalogo-sync-na-default.md) |
| 8 | [task-08-seed-postman-e-verificacao.md](./tasks/task-08-seed-postman-e-verificacao.md) |

**Ordem de execução:** 1 → 2 → (3 ∥ 4 ∥ 7) → (5 ∥ 6) → 8

Grupo 7 só precisa do 2 (resolver default); pode paralelo a 3/4. Grupos 5 e 6 precisam do 2. Grupo 8 espera 3–7.

**Artefatos de contexto:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs · [FRONT-INTEGRATION.md](./FRONT-INTEGRATION.md)

## 1. Schema e migration

📄 [Detalhes](./tasks/task-01-schema-e-migration.md)

- [x] 1.1 Adicionar `isDefault` em `WhatsappAccount` (unique parcial de um default), unique em `phoneNumberId`, e `TenantOutreachConfig.whatsappAccountId` nullable exclusivo
- [x] 1.2 Migration SQL com backfill da default na conta plataforma enabled de menor `id`; gerar client Prisma

## 2. Resolver de credenciais

📄 [Detalhes](./tasks/task-02-resolver-de-credenciais.md)

- [x] 2.1 `resolveCredentials(tenantId?)` no notifly: dedicado se FK válida e enabled; senão default; dedicado disabled não faz fallback
- [x] 2.2 Mesmo algoritmo em `PlatformWhatsappAdminService` no gym-ctrl

## 3. Admin — WhatsApp accounts

📄 [Detalhes](./tasks/task-03-admin-whatsapp-accounts.md)

- [x] 3.1 CRUD `/platform/whatsapp-accounts`: listar todas as plataforma, `isDefault`, recusar `wabaId` divergente, unique `phoneNumberId`, `tenantId` continua null
- [x] 3.2 Promover default na mesma transação; recusar `enabled=false` na default e promover conta amarrada a tenant

## 4. Admin — amarração no outreach config

📄 [Detalhes](./tasks/task-04-admin-amarracao-no-outreach-config.md)

- [x] 4.1 `whatsappAccountId` platform-owned no PATCH/PUT `/platform`; validações (não-default, enabled, exclusivo); GET com conta resolvida
- [x] 4.2 `/tenant` GET inclui campo só leitura; PATCH/PUT Admin com `whatsappAccountId` → 403; create Admin persiste null

## 5. Notifly — envios por tenant

📄 [Detalhes](./tasks/task-05-notifly-envios-por-tenant.md)

- [x] 5.1 `contactLeads` e notify de reply usam `resolveCredentials(tenant.id)`
- [x] 5.2 Campanhas de lista e notify de botão usam o resolver do tenant da campanha

## 6. Inbox e webhook

📄 [Detalhes](./tasks/task-06-inbox-e-webhook.md)

- [x] 6.1 Reply de conversa no gym-ctrl envia pelo número resolvido do `:tenantId`
- [x] 6.2 Webhook: `context.id` primeiro; senão `metadata.phone_number_id` só mapeia número dedicado; default sem context não inventa tenant

## 7. Catálogo — sync na default

📄 [Detalhes](./tasks/task-07-catalogo-sync-na-default.md)

- [x] 7.1 Sync admin e cron upsertam templates só na conta `isDefault`; test-send aceita `whatsappAccountId` opcional (senão default)

## 8. Seed, Postman e verificação

📄 [Detalhes](./tasks/task-08-seed-postman-e-verificacao.md)

- [x] 8.1 Seed marca a conta plataforma existente como default
- [x] 8.2 Postman: segundo número, promover default, amarrar/desamarrar, 403 no Admin, sync sem duplicar catálogo
- [x] 8.3 `npx prisma validate`; confirmar que envios e inbox não usam `findFirst` cego de conta plataforma
