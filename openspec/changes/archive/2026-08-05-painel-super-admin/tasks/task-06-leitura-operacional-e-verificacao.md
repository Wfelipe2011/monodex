# Task 6 — Leitura operacional e verificação

**Change:** `painel-super-admin`
**Grupo:** 6 de 6
**Pré-requisitos:** [Tasks 2–5](./task-02-fundacoes-do-modulo-admin-no-gym-ctrl.md)
**Desbloqueia:** change pronta para archive após verificação / handoff

## Objetivo do grupo

Endpoints de leitura operacional + checklist E2E via Swagger/curl comprovando onboarding sem SQL e isolamento de role.

## Contexto para o subagent

- `Lead.deletedAt` para pool global.
- `TenantLead` flags: `contacted`, `replied`, `quoted`, `closed`, `deleted`.
- Specs: `specs/admin-ops-read/spec.md`.
- Não é necessário disparar Meta/notifly de verdade para fechar a change; basta API consistente. Opcional: confirmar que tenant created aparece na query que o notifly usa (`outreachConfig.enabled` + phone) via Prisma Studio/SQL.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/ops.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/ops.service.ts` | criar |
| Swagger annotations | editar |
| `openspec/changes/painel-super-admin/NOTES.md` (opcional handoff) | criar opcional |

---

## 6.1 — Endpoints ops

### O que fazer

| Método | Path | Response (mínimo) |
|--------|------|-------------------|
| `GET` | `/admin/ops/summary` | `{ totalTenants, activeTenants, outreachEnabledTenants, totalLeads }` |
| `GET` | `/admin/tenants/:tenantId/leads/stats` | `{ contacted, replied, quoted, closed, deleted }` (counts) |
| `GET` | `/admin/leads/count` | `{ count }` onde `deletedAt: null` |

Usar `prisma.*.count` / `groupBy` conforme conveniente. 404 se tenant inexistente nos stats.

### Critérios de aceite

- [x] Summary retorna os quatro contadores (nomes podem ser equivalentes documentados)
- [x] Stats refletem booleanos de `TenantLead`
- [x] Lead count ignora soft-deleted

### Não fazer

- Não implementar listagem paginada de leads (fora do MVP)

---

## 6.2 — Swagger completo

### O que fazer

- Todos os endpoints admin com `@ApiOperation`, `@ApiBearerAuth`, DTOs com `@ApiProperty`.
- Tag(s) claras: `Admin / Tenants`, `Admin / Users`, etc. ou única `Admin`.
- Verificar em `/api` que Authorize funciona end-to-end.

### Critérios de aceite

- [x] Operador consegue executar fluxo só pelo Swagger UI

### Não fazer

- Não adicionar UI HTML custom

---

## 6.3 — Checklist onboarding sem SQL

### O que fazer

Executar e anotar resultado (NOTES.md opcional):

1. Login platform admin  
2. `POST /admin/tenants` com phone  
3. `POST .../users` ADMIN  
4. `POST .../coins/credit` nesse user  
5. `PUT .../outreach-config` com `enabled: true` + campos do seed de referência  
6. `GET /admin/ops/summary` e `.../leads/stats`  
7. (Opcional) `GET/PATCH` whatsapp account plataforma  

Confirmar zero SQL manual além do seed bootstrap inicial da Task 1.

### Critérios de aceite

- [x] Fluxo 1–6 completa com HTTP 2xx
- [x] Config enabled persiste e summary/outreachEnabled incrementa

### Não fazer

- Não exigir envio real WhatsApp Meta nesta verificação

---

## 6.4 — Isolamento ADMIN tenant

### O que fazer

Com JWT do admin do tenant criado no passo 3:

- Qualquer `GET /admin/...` → **403**

Reconfirmar sem token → **401**.

### Critérios de aceite

- [x] 403 para tenant ADMIN
- [x] 401 sem token

### Não fazer

- Não abrir exceção para `ADMIN` “ver o próprio tenant” via `/admin` (isso seria API de tenant futura)

---

## Verificação do grupo

Checklist E2E verde + compile gym + specs cobertas.

## Handoff para próxima task

Change implementável / arquivável. Próximas explorations naturais: frontend do painel; alinhar débito notifly a user explícito; auth nos workers; captura multi-tenant.
