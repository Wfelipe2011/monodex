# Task 5 — APIs de send-policy e template grants

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 5 de 8
**Pré-requisitos:** [Task 1](./task-01-schema-e-migration.md), [Task 2](./task-02-guards-e-helpers-de-autorizacao.md), [Task 3](./task-03-prefixo-platform-e-split-de-campos-super-admin.md)
**Desbloqueia:** [Task 6](./task-06-pedidos-de-scrape-pelo-admin.md) (city policy no POST scrape), [Task 7](./task-07-runtime-notifly.md)

## Objetivo do grupo

Super Admin escreve território/exclusividade e grants; Admin lê policy e lista só templates granted.

## Contexto para o subagent

- Models: `TenantSendPolicy`, `TenantRespect`, `TenantTemplateGrant`.
- Helpers: `assertCityPolicyXor` em `libs/shared/send-policy.ts`.
- Templates: `whatsapp-templates.controller.ts` já lista catálogo full no platform (grupo 3).
- `WhatsappMessageTemplate.id` é a FK do grant.
- Admin module: registrar novos controllers/services.
- Specs: `tenant-send-policies`, `tenant-template-grants`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/send-policy.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/send-policy.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/upsert-send-policy.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/template-grants.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/template-grants.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/tenant-templates.controller.ts` | criar (GET granted) |
| `admin.module.ts` | editar |

---

## 5.1 — PUT send-policy platform

### O que fazer

`GET/PUT /platform/tenants/:tenantId/send-policy` `@RolesAuth(SUPER_ADMIN)`.

Body exemplo:

```json
{
  "allowedCityIds": [1],
  "deniedCityIds": [],
  "respectAllTenants": false,
  "exclusive": false,
  "respectTenantIds": [2, 3]
}
```

XOR via helper. `respectTenantIds` não pode incluir `tenantId`. Upsert policy + replace edges `TenantRespect` (deleteMany + createMany). GET devolve o mesmo shape.

### Critérios de aceite

- [ ] Ambos arrays não-vazios → 400
- [ ] Self-respect → 400
- [ ] PUT persistido e GET ecoa

### Não fazer

- Não aplicar filtro no notifly neste grupo

---

## 5.2 — GET policy no tenant

### O que fazer

`GET /tenant/:tenantId/send-policy` com scope guard; ADMIN + SUPER_ADMIN GET. Sem PUT neste prefixo (403 se alguém mapear).

### Critérios de aceite

- [ ] Admin lê a policy do próprio tenant
- [ ] Admin PUT (se existir rota) 403

### Não fazer

- Não esconder flags do Admin (leitura total)

---

## 5.3 — CRUD grants

### O que fazer

- `GET /platform/tenants/:tenantId/template-grants`
- `PUT` ou `POST` `{ templateId }` + `DELETE /:templateId`
- 404 se template catálogo inexistente
- Unique `(tenantId, templateId)` — POST duplicado 200/409 idempotente (preferir upsert)

### Critérios de aceite

- [ ] Mesmo templateId em dois tenants ok
- [ ] Admin POST grant 403

### Não fazer

- Não aceitar `name` Meta no lugar de id

---

## 5.4 — GET templates granted

### O que fazer

`GET /tenant/:tenantId/whatsapp-templates` join grant + catalog: `id, name, language, status, slots`. Sem chamar Graph / `PlatformWhatsappAdminService.sync`.

### Critérios de aceite

- [ ] Template não granted omitido
- [ ] Não dispara sync (sem log de fetch WABA)

### Não fazer

- Não expor `tokenEnvKey` / secrets

---

## Verificação do grupo

Swagger: Platform send-policy + grants; Tenant GET policy + templates filtrados.

## Handoff para próxima task

Policy lida pelo scrape (grupo 6) e notifly (grupo 7). Grants já validados no grupo 4 se a task 4 rodou antes — ordem 4 e 5 após 3; se 4 rodou sem grants, enable fica 400 até 5.1/5.3. Preferir 5 antes de enable E2E no grupo 8.
