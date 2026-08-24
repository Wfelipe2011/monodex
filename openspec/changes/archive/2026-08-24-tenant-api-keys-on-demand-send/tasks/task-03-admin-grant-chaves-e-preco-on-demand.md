# Task 3 — Admin — grant, chaves e preço on-demand

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 3 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-hash-de-chave-e-authguard-dual-mode.md)
**Desbloqueia:** [task-05](./task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md), [task-08](./task-08-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Super Admin liga API e o preço do canal; Admin do tenant cria/lista/revoga até 3 chaves ativas (plaintext só no 201).

## Contexto para o subagent

- PATCH tenant platform: `apps/gym-ctrl/src/modules/admin/tenants.controller.ts` + `tenants.service.ts`. DTO `UpdateTenantDto` (`name`, `phone`, `active`). Select `tenantSelect` **não** inclui o novo flag — incluir `apiAccessEnabled`.
- Tenant Admin path `TenantSelfController` rejeita `active` via `rejectForbiddenBodyKeys(req.body, ['active'])` — incluir `apiAccessEnabled` nessa lista.
- Outreach platform PATCH: `PatchPlatformOutreachConfigDto` em `dto/patch-platform-outreach-config.dto.ts`. Service `PLATFORM_OUTREACH_KEYS` em `outreach-config.service.ts` (linhas ~34–39): adicionar `costPerOnDemandSend`. Tenant PATCH já chama `rejectForbiddenBodyKeys(rawBody, PLATFORM_OUTREACH_KEYS)`.
- Specs existentes de outreach: `outreach-config.service.spec.ts` (padrão coinDebitOnStatus).
- Create de config Admin: `costPerLead: 0` — setar também `costPerOnDemandSend: 0`.
- Mapper GET deve devolver o campo (platform e tenant).
- Chaves: novo controller `tenant/:tenantId/api-keys` no `admin.module.ts`. **Sem** `@ApiKeyAllowlist`. Roles `ADMIN`+`SUPER_ADMIN` GET; POST/revoke só `ADMIN` (403 Super Admin, igual conversa POST).
- Hash: `hashApiKey` / `generateApiKey` / `apiKeyPrefix` do grupo 2.
- `TenantActiveGuard` já bloqueia escrita se inativo.
- Sem allowlist nestas rotas → chave **não** gerencia chaves (401).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/dto/update-tenant.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/tenants.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/tenants.controller.ts` | editar (forbidden keys) |
| `apps/gym-ctrl/src/modules/admin/dto/patch-platform-outreach-config.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/api-keys.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/api-keys.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/create-api-key.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |
| specs de service correspondentes | criar/editar |

---

## 3.1 — `apiAccessEnabled`

### O que fazer

`UpdateTenantDto`: `apiAccessEnabled?` boolean. `TenantsService.update` persiste se enviado (só chamado pelo controller platform `SUPER_ADMIN`). GET/list incluem o campo.

`TenantSelfController` PATCH: `rejectForbiddenBodyKeys(req.body, ['active', 'apiAccessEnabled'])`.

Grant off: grupo 2 já 401 na auth; create de chave (3.2) também 403 se flag false.

### Critérios de aceite

- [ ] Super Admin PATCH `{ apiAccessEnabled: true }` persiste
- [ ] Admin body com o campo → 403
- [ ] GET platform do tenant devolve o flag

### Não fazer

- Não default true em tenant novo

---

## 3.2 — CRUD de chaves

### O que fazer

`POST /tenant/:tenantId/api-keys` body `{ name }` (string min 1). Se `apiAccessEnabled` false → 403. Count `revokedAt: null` ≥ 3 → 409. 201: `{ id, name, prefix, key, createdAt }` — `key` é o raw **só aqui**.

`GET /` lista do tenant **sem** `key`/`keyHash`. Incluir `revokedAt`, `lastUsedAt`.

`POST /:keyId/revoke` (ou DELETE): set `revokedAt=now` se daquele tenant e ainda null; idempotente 200 se já revogada.

Super Admin GET ok; POST/revoke → 403 (`req.user.roles` SUPER_ADMIN).

### Critérios de aceite

- [ ] 201 contém raw; GET não contém
- [ ] 4ª ativa → 409; após 1 revoke, create ok
- [ ] Super Admin não cria

### Não fazer

- Não `@ApiKeyAllowlist` nestas rotas
- Não devolver `keyHash`

---

## 3.3 — `costPerOnDemandSend`

### O que fazer

DTO platform: `@IsOptional() @IsNumber() @Min(0) costPerOnDemandSend?`. Incluir em `PLATFORM_OUTREACH_KEYS` e no `patchPlatform` data spread (espelhar `costPerLead`).

GET mapper (platform e tenant) inclui o campo.

Create Admin missing config: `costPerOnDemandSend: 0`.

Negativo → 400. `failed` não se aplica (não é enum).

Estender `patch-platform-outreach-config.dto.spec.ts` e `outreach-config.service.spec.ts` no mesmo estilo de `coinDebitOnStatus`.

### Critérios de aceite

- [ ] Super Admin PATCH persiste
- [ ] Admin PATCH com o campo → 403
- [ ] GET devolve o valor
- [ ] Create sem campo → 0

### Não fazer

- Não exigir `costPerOnDemandSend > 0` para **habilitar outreach de cidade** (`enabled=true` continua só `costPerLead`)

---

## 3.4 — Testes

### O que fazer

Tenants: enable flag; Admin 403. Api keys: create/list/revoke/cap/grant off/Super Admin 403. Outreach: preço platform vs tenant.

### Critérios de aceite

- [ ] Specs Jest passam

### Não fazer

- Não testar send Graph neste grupo

---

## Verificação do grupo

PATCH platform tenant + outreach; POST 3 chaves + 4ª 409; list sem secret.

## Handoff para próxima task

Preço e chaves existem. Send (grupo 5) lê `costPerOnDemandSend` e `apiAccessEnabled` (este último já na auth).
