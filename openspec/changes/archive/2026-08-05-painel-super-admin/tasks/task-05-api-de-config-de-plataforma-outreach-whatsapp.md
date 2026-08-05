# Task 5 — API de config de plataforma (outreach + WhatsApp)

**Change:** `painel-super-admin`
**Grupo:** 5 de 6
**Pré-requisitos:** [Task 3](./task-03-api-de-tenants-e-users.md) (tenant com phone/active); Task 4 recomendada para onboarding real
**Desbloqueia:** [Task 6](./task-06-leitura-operacional-e-verificacao.md)

## Objetivo do grupo

API para upsert de `TenantOutreachConfig` e CRUD de `WhatsappAccount` da plataforma (`tenantId` null), sem nunca lidar com o token Meta em si.

## Contexto para o subagent

- Models em `prisma/schema.prisma`: `TenantOutreachConfig` (1:1 `tenantId`), `WhatsappAccount` (`tenantId` opcional, `tokenEnvKey`, `phoneNumberId`, `WhatsappProvider.CLOUD_API`).
- Runtime: `apps/notifly/src/leads.service.ts` (schedule, enabled, costPerLead); `apps/notifly/src/platform-whatsapp.service.ts` resolve credenciais da conta plataforma.
- Formato `schedule` de referência em `prisma/seed-outreach.ts`:
  ```js
  { "2": [18], "3": [18], "4": [13, 18] }
  ```
- `categories`: JSON array de strings.
- Validação enable: `Tenant.phone` não nulo/não vazio (trim) e `Tenant.active === true`.
- Design D5/D8: nunca aceitar campo `token` / `accessToken` no body.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/outreach-config.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.service.ts` | criar |
| DTOs + `admin.module.ts` | criar/editar |

---

## 5.1 — Outreach config endpoints

### O que fazer

| Método | Path |
|--------|------|
| `GET` | `/admin/tenants/:tenantId/outreach-config` → 404 se não houver |
| `PUT` | `/admin/tenants/:tenantId/outreach-config` → upsert completo |
| `PATCH` | `/admin/tenants/:tenantId/outreach-config` → parcial |

Campos: `enabled`, `costPerLead`, `cashbackOnReply`, `outreachTemplateName`, `notifyTenantTemplateName`, `schedule`, `categories`.

PUT exige campos obrigatórios do model (exceto defaults sensatos). Para create via PUT, exigir todos os required do Prisma.

### Critérios de aceite

- [ ] PUT cria config se não existe
- [ ] PATCH altera só campos enviados
- [ ] GET retorna config persistida

### Não fazer

- Não hardcodar templates no service além de validação de string não vazia quando enabled

---

## 5.2 — Validação enabled

### O que fazer

Antes de persistir `enabled: true` (PUT ou PATCH):

1. Carregar tenant.
2. Se `!tenant.active` → 400.
3. Se `!tenant.phone?.trim()` → 400.
4. Se for PATCH só `{enabled:true}` sem config prévia com templates/cost → 400 (ou exigir PUT completo antes).

`costPerLead` deve ser `> 0` quando enabled.

### Critérios de aceite

- [ ] Enable sem phone → 400
- [ ] Enable com active false → 400
- [ ] Enable válido persiste true

### Não fazer

- Não alterar coluna `phone` implicitamente

---

## 5.3 — WhatsApp accounts plataforma

### O que fazer

| Método | Path |
|--------|------|
| `GET` | `/admin/whatsapp-accounts` (default filter `tenantId: null`) |
| `POST` | `/admin/whatsapp-accounts` |
| `GET` | `/admin/whatsapp-accounts/:id` |
| `PATCH` | `/admin/whatsapp-accounts/:id` |

Create força `tenantId: null`, `provider: CLOUD_API` (default). Body: `phoneNumberId`, `displayPhone?`, `tokenEnvKey?` (default `WHATSAPP_TOKEN`), `enabled?`.

Se body trouxer `tenantId` não nulo → 400.

### Critérios de aceite

- [ ] Conta criada com `tenantId` null
- [ ] List não mistura contas futuras de tenant (filtro)
- [ ] Patch atualiza `phoneNumberId`

### Não fazer

- Não implementar WABA por tenant comercial

---

## 5.4 — Sem token secreto

### O que fazer

- DTOs sem campo de token/secret.
- Se request JSON contiver chaves suspeitas (`token`, `accessToken`, `whatsappToken`), rejeitar 400 **ou** silenciar/ignorar — preferir 400 explícito.
- Responses: apenas campos do model Prisma (que já não têm o secret).

### Critérios de aceite

- [ ] Nenhum endpoint documenta ou devolve access token Meta
- [ ] Persistência só de `tokenEnvKey` string

### Não fazer

- Não ler `process.env` do token e devolvê-lo ao client “para conferência”

---

## Verificação do grupo

PUT config enabled com phone → GET mostra enabled → PATCH schedule → GET whatsapp accounts.

## Handoff para próxima task

Onboarding API completo possível; Task 6 fecha summary/stats e checklist E2E.
