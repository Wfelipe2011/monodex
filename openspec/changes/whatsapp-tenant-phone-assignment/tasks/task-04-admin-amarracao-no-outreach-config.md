# Task 4 — Admin — amarração no outreach config

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 4 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-08](./task-08-seed-postman-e-verificacao.md)

## Objetivo do grupo

Super Admin atrela/desatrela `whatsappAccountId` no outreach config. Admin do tenant só lê o número resolvido.

## Contexto para o subagent

- Controllers: `apps/gym-ctrl/src/modules/admin/outreach-config.controller.ts`
  - Platform: `PATCH /platform/tenants/:tenantId/outreach-config` → `patchPlatform` (hoje só preço)
  - Tenant: `PATCH /tenant/:tenantId/outreach-config` → `patchTenant` + `rejectForbiddenBodyKeys(rawBody, PLATFORM_OUTREACH_KEYS)`
- Service: `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts`
  - `PLATFORM_OUTREACH_KEYS = ['costPerLead', 'cashbackOnReply']` — **adicionar** `whatsappAccountId`
  - `TENANT_OWNED_OUTREACH_KEYS` **não** inclui o campo novo
  - `get()` devolve a row Prisma crua com `CONFIG_INCLUDE` (templates). Enriquecer com conta resolvida.
  - `createBootstrap` (PUT platform) pode persistir `whatsappAccountId` se vier no DTO.
  - `createTenant` (PUT tenant) **não** persiste o campo; sempre `null`.
- DTOs:
  - `dto/patch-platform-outreach-config.dto.ts` — só preço hoje
  - `dto/upsert-outreach-config.dto.ts` — PUT platform bootstrap
  - `dto/patch-outreach-config.dto.ts` e `upsert-tenant-outreach-config.dto.ts` — **não** adicionar o campo (whitelist); 403 vem do `rejectForbiddenBodyKeys` no raw body
- Validação de alvo: conta `tenantId` null, `enabled`, `provider CLOUD_API`, `isDefault === false`, e nenhum outro config com essa FK. Id da default → 400. Prisma unique → 400 se corrida.
- `assertSuperAdminTenantWrite(..., isPlatformField: true)` já permite PATCH de plataforma depois da janela de 30 min.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/patch-platform-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/upsert-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.controller.ts` | editar (Swagger) |

---

## 4.1 — Platform PATCH/PUT e GET resolvido

### O que fazer

DTO platform PATCH: `whatsappAccountId?: number | null` (`ValidateIf` para permitir null explícito; `@IsInt @Min(1)` quando number).

Helper `assertAssignableWhatsappAccount(id: number | null)`:

- `null` ok (unassign)
- load account; 400 se não existir / `tenantId != null` / disabled / `isDefault` / já assigned a **outro** tenant
- mesmo id já neste tenant = no-op ok

`patchPlatform` persiste o campo quando presente.

`createBootstrap` persiste `whatsappAccountId` via o mesmo helper (omitido → null).

`get()` (usado por platform e tenant): incluir

```json
{
  "whatsappAccountId": 2,
  "resolvedWhatsappAccount": {
    "id": 2,
    "phoneNumberId": "...",
    "displayPhone": "+55...",
    "isDefault": false
  }
}
```

Se FK null, `resolvedWhatsappAccount` = a conta default (ou null só se não houver default — não deveria).

### Critérios de aceite

- [ ] PATCH platform `{ whatsappAccountId: 2 }` em conta válida não-default → persistido
- [ ] PATCH `{ whatsappAccountId: null }` → volta ao default
- [ ] PATCH com id da default → 400
- [ ] PATCH com id já usado por outro tenant → 400
- [ ] PATCH `{ costPerLead, whatsappAccountId }` juntos funciona depois da janela de 30 min
- [ ] GET inclui `resolvedWhatsappAccount`

### Não fazer

- Não exigir janela de 30 min para este campo
- Não deixar Admin escrever via DTO “escondido” (o 4.2 cobre raw body)

---

## 4.2 — Superfície `/tenant`: 403 na escrita, GET só leitura

### O que fazer

`PLATFORM_OUTREACH_KEYS` inclui `'whatsappAccountId'`.

`createTenant` / `patchTenant` já chamam `rejectForbiddenBodyKeys(rawBody, PLATFORM_OUTREACH_KEYS)` → 403 se Admin mandar o campo.

`createTenant` data: não setar FK (null).

Atualizar descriptions Swagger: PATCH platform agora preço **e** número; tenant PATCH continua sem o campo.

### Critérios de aceite

- [ ] Admin PATCH `{ whatsappAccountId: 2 }` → 403, row inalterada
- [ ] Admin PUT create sem o campo → `whatsappAccountId` null
- [ ] Admin GET vê `whatsappAccountId` e `resolvedWhatsappAccount` (default se null)

### Não fazer

- Não adicionar `whatsappAccountId` em `PatchOutreachConfigDto` (whitelist faria o campo sumir em vez de 403; o reject é no raw body)

---

## Verificação do grupo

Dois tenants: um PATCH dedicado, outro null. GET de cada um mostra números diferentes no resolved. Admin 403.

## Handoff para próxima task

Runtime (5–6) lê a FK. Postman (8) cobre os cases.
