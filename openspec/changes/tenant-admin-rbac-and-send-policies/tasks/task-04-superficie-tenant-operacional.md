# Task 4 — Superfície /tenant operacional

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 4 de 8
**Pré-requisitos:** [Task 2](./task-02-guards-e-helpers-de-autorizacao.md), [Task 3](./task-03-prefixo-platform-e-split-de-campos-super-admin.md)
**Desbloqueia:** [Task 6](./task-06-pedidos-de-scrape-pelo-admin.md) (padrão de controller tenant), [Task 8](./task-08-postman-seeds-e-verificacao.md)

## Objetivo do grupo

Admin opera o próprio tenant em `/tenant/:tenantId/*`; Super Admin só GET (e pontapé); conta inativa só consultiva.

## Contexto para o subagent

- Controllers atuais (ainda `/admin/tenants/:tenantId/...`): `lead-lists.controller.ts`, `list-campaigns.controller.ts`, `list-conversations.controller.ts`, `outreach-config.controller.ts` (parte operacional).
- Push: `apps/gym-ctrl/src/modules/inbox-realtime/push-subscriptions.controller.ts` `@Controller('admin/push-subscriptions')` **sem** RolesAuth (qualquer JWT). Deep link em `inbox-web-push.service.ts` linha ~72: `/admin/tenants/${dto.tenantId}/lead-lists/...`.
- Inbox realtime module separado de `AdminModule`.
- JWT: `UserToken.tenantId`.
- `CreateLeadListDto` hoje exige `costPerSend` `@Min(0.000001)` — passar a só `name`.
- `OutreachConfigService.assertEnableAllowed` deve ser chamado em PATCH Admin de `enabled`.
- Grants: grupo 5 pode ainda não ter API; **validar** `TenantTemplateGrant` no Prisma ao persistir template ids (tabela já existe após task 1). Se grant vazio, Admin não consegue enable — esperado.
- Specs: `tenant-operator-api`, `tenant-outreach-config`, `tenant-list-leads`, `tenant-list-campaigns`, `whatsapp-conversation-inbox`, `inbox-web-push`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| Controllers list/campaign/inbox/outreach operacional | editar path + guards |
| DTOs outreach tenant vs platform | editar/criar |
| `create-lead-list.dto.ts` | editar |
| `users.controller.ts` tenant | criar ou split |
| `push-subscriptions.controller.ts` | editar |
| `inbox-web-push.service.ts` | editar `data.url` |
| `admin.module.ts` / `inbox-realtime.module.ts` | editar |

---

## 4.1 — Guards nos controllers tenant

### O que fazer

`@Controller('tenant/:tenantId/...')` + `@RolesAuth(Roles.ADMIN)` **e** aceitar Super Admin no GET: `RolesGuard` atual é OR — `@RolesAuth(Roles.ADMIN, Roles.SUPER_ADMIN)` para GET e writes; writes Super Admin filtradas no service via helper bootstrap.

Aplicar `@UseGuards(TenantScopeGuard, TenantActiveGuard)` (Active só em mutações — se o guard já ignora GET, pode ir na classe).

### Critérios de aceite

- [ ] ADMIN de 4 em `/tenant/9/...` → 403
- [ ] SUPER_ADMIN GET `/tenant/4/outreach-config` não 403 de role

### Não fazer

- Não usar só `@RolesAuth(ADMIN)` sem Super Admin no GET

---

## 4.2 — Outreach operacional

### O que fazer

- GET: devolve row completa incluindo `costPerLead` (read-only para Admin).
- PATCH DTO tenant: `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, `notifyTemplateId`. Se `costPerLead`/`cashbackOnReply` presentes → 403 (`reject` explícito).
- PUT se 404: cria com `costPerLead: 0`, `cashbackOnReply: 0`, campos Admin do body.
- Super Admin PATCH tenant fields só se `isWithinBootstrapWindow(config.createdAt)`.
- Enable: regras atuais (phone, active, APPROVED, bindings) **+** ids granted.

### Critérios de aceite

- [ ] Admin PATCH knobs 200
- [ ] Admin PATCH preço 403
- [ ] GET mostra `costPerLead`

### Não fazer

- Não reativar PUT full do Super Admin neste path após existir config (isso é 403 fora da janela)

---

## 4.3 — Listas, campanhas, inbox, users, coins GET, stats, phone

### O que fazer

Mover paths:

- `/tenant/:tenantId/lead-lists` CRUD leads/import/template
- `/tenant/:tenantId/category-suggestions` (hoje `TenantCategorySuggestionsController` em `lead-lists.controller.ts` `@Controller('admin/tenants/:tenantId')`)
- campanhas e sends
- messages GET + POST
- `PATCH /tenant/:tenantId` só `{ phone }` (não `active`)
- users list/create/patch/reset (Admin)
- `GET /tenant/:tenantId/coins` e `coin-transactions` (sem credit/debit)
- `GET /tenant/:tenantId/leads/stats`

POST reply inbox: Super Admin 403 fora bootstrap (conversation não tem `createdAt` de “recurso campanha”; **não** usar janela em reply — spec: Super Admin POST reply 403. Simplificar: reply **nunca** Super Admin).

### Critérios de aceite

- [ ] Admin cria lista sem `costPerSend`
- [ ] Admin cria user adicional
- [ ] Super Admin POST message 403
- [ ] Super Admin GET messages 200

### Não fazer

- Não deixar Super Admin PATCH `active` no prefixo tenant

---

## 4.4 — Grants na validação de template

### O que fazer

Antes de persistir FKs de template, `findUnique` grant `(tenantId, templateId)`. Sem row → `BadRequestException`. Campanha `templateId` / `notifyTemplateId` igual. Reusar no enable.

### Critérios de aceite

- [ ] Template não granted → 400

### Não fazer

- Não sync Graph neste GET/PATCH

---

## 4.5 — Create lista sem preço

### O que fazer

`CreateLeadListDto`: remover `costPerSend`. Service `create` grava `costPerSend: 0`. Admin PATCH lista não aceita `costPerSend` (403 se enviado).

### Critérios de aceite

- [ ] POST `{ name }` → `costPerSend === 0`

### Não fazer

- Não quebrar unique/name vazio (`MinLength(1)` permanece)

---

## 4.6 — Push path e lock

### O que fazer

`@Controller('tenant/push-subscriptions')`. Se `Tenant.active=false` do `user.tenantId`, PUT/DELETE 403. Atualizar `data.url` para `/tenant/{tenantId}/lead-lists/{listId}/leads/{leadId}`.

### Critérios de aceite

- [ ] Path novo no controller
- [ ] URL no payload push atualizada

### Não fazer

- Não mudar VAPID

---

## Verificação do grupo

Nenhum `@Controller('admin/tenants/:tenantId/lead-lists')` restante. Swagger Tenant vs Platform.

## Handoff para próxima task

Padrão de `/tenant/:tenantId` + guards pronto para scrape requests (grupo 6) e GET policy/templates (grupo 5).
