# Task 3 — Admin — listas e leads

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 3 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-recipient-bindings-e-helpers.md)
**Desbloqueia:** [task-04](./task-04-admin-campanhas.md), [task-07](./task-07-admin-api-de-conversa.md)

## Objetivo do grupo

APIs SUPER_ADMIN para CRUD de listas/leads, import CSV e template de exemplo.

## Contexto para o subagent

- Padrão admin: `@RolesAuth(Roles.SUPER_ADMIN)` — ver `outreach-config.controller.ts`
- Registrar controllers/services em `apps/gym-ctrl/src/modules/admin/admin.module.ts`
- Prefixo: `/admin/tenants/:tenantId/lead-lists`
- Multipart: usar `@nestjs/platform-express` `FileInterceptor` (já disponível no Nest)

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/lead-lists.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/lead-lists.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/*.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |

---

## 3.1 — CRUD listas e leads

### O que fazer

**Endpoints:**

```
GET    /admin/tenants/:tenantId/lead-lists
POST   /admin/tenants/:tenantId/lead-lists
GET    /admin/tenants/:tenantId/lead-lists/:listId
PATCH  /admin/tenants/:tenantId/lead-lists/:listId

GET    /admin/tenants/:tenantId/lead-lists/:listId/leads
POST   /admin/tenants/:tenantId/lead-lists/:listId/leads
POST   /admin/tenants/:tenantId/lead-lists/:listId/leads/bulk   { leads: [...] }
GET    /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId
PATCH  /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId
DELETE /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId
```

Validações:
- Tenant existe (404)
- `costPerSend > 0` na lista
- `phone` normalizado via `normalizeListPhone`; unique por lista → 400 em duplicata
- `name` obrigatório; `reviews` int ≥ 0 se presente

DTOs com class-validator; Swagger decorators como nos outros admin controllers.

### Critérios de aceite

- [ ] CRUD completo funcional via curl/Postman
- [ ] Duplicata de phone retorna 400

### Não fazer

- Campanhas (task 4)
- Conversa (task 7)

---

## 3.2 — Import CSV e template

### O que fazer

**`GET .../lead-lists/:listId/import-template`**
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="lead-list-import-example.csv"`
- Cabeçalho: `name,phone,website,category,reviews`
- 1–2 linhas exemplo

**`POST .../lead-lists/:listId/import`** — `multipart/form-data` field `file`

Parser CSV (pode usar `csv-parse` se já no monorepo, senão parser simples line-by-line para MVP):
- Headers case-insensitive
- Falha atômica (transaction) se qualquer linha inválida ou phone duplicado no arquivo ou lista
- Resposta: `{ created: number }`

**`GET /admin/tenants/:tenantId/category-suggestions`**
- `SELECT DISTINCT category` de `Lead.category` + `TenantListLead.category` do tenant (via lists)
- Retornar array de strings únicas para autocomplete (normalização só para dedup na resposta)

### Critérios de aceite

- [ ] Import válido cria N leads
- [ ] CSV exemplo baixável
- [ ] Linha inválida não deixa partial data

### Não fazer

- XLSX (nice-to-have futuro)

---

## Verificação do grupo

Swagger em `/api` (gym-ctrl); testar create list → add lead → import.

## Handoff

Listas e leads existem no DB; campanhas referenciam `listId`.
