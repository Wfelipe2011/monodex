# Task 3 — Prefixo /platform e split de campos Super Admin

**Change:** `tenant-admin-rbac-and-send-policies`
**Grupo:** 3 de 8
**Pré-requisitos:** [Task 1](./task-01-schema-e-migration.md), [Task 2](./task-02-guards-e-helpers-de-autorizacao.md)
**Desbloqueia:** [Task 5](./task-05-apis-de-send-policy-e-template-grants.md) (paths platform), [Task 8](./task-08-postman-seeds-e-verificacao.md)

## Objetivo do grupo

`/platform/*` só `SUPER_ADMIN`; preço e WhatsApp/scrape global/ops permanecem aqui; users = só o primeiro; outreach platform-owned separado.

## Contexto para o subagent

- Módulo: `apps/gym-ctrl/src/modules/admin/` — `admin.module.ts` registra todos os controllers atuais com `@Controller('admin/...')`.
- Controllers a **mover prefixo** (não copiar lógica): `tenants`, `users` (restrito), `coins` (write fica aqui; GET também pode ficar duplicado no tenant no grupo 4), `whatsapp-accounts`, `whatsapp-templates`, `platform-job-schedules`, `scrape-targets`, `scrape-coverages`, `ops`, `admin-health`.
- Outreach hoje: `outreach-config.controller.ts` `@Controller('admin/tenants/:tenantId/outreach-config')` + `UpsertOutreachConfigDto` / `PatchOutreachConfigDto` com **todos** os campos misturados.
- `OutreachConfigService.upsert/patch` em `outreach-config.service.ts` — `assertEnableAllowed` hoje assume Super Admin ligando `enabled`.
- `UsersService.create` não limita a “primeiro user”.
- `CreateLeadListDto` exige `costPerSend` > 0 — grupo 4 tira isso do Admin; aqui só PATCH platform.
- Swagger `@ApiTags` e `@RolesAuth(Roles.SUPER_ADMIN)` permanecem.
- Specs: `specs/super-admin-identity/spec.md`, `specs/admin-platform-config/spec.md`, `specs/admin-tenant-lifecycle/spec.md`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/*.controller.ts` (plataforma) | editar `@Controller('platform/...')` |
| `apps/gym-ctrl/src/modules/admin/users.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/dto/patch-platform-outreach-config.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/lead-lists.service.ts` | editar (patch cost) |
| `apps/gym-ctrl/src/modules/admin/dto/patch-list-cost.dto.ts` | criar |

---

## 3.1 — Mover prefixo /admin → /platform

### O que fazer

Trocar `@Controller('admin/...')` dos recursos de plataforma para `'platform/...'`. Health: `GET /platform/health` (hoje `admin-health.controller.ts` `@Controller('admin')` + `@Get('health')`). Ops: `GET /platform/ops/summary`, `GET /platform/leads/count`. **Não** mover lead-lists/campaigns/inbox/push neste grupo (grupo 4).

Job schedules: `/platform/platform-job-schedules` (ou `/platform/job-schedules` se documentar no Swagger; preferir espelhar o path antigo trocando só o prefixo: `/platform/platform-job-schedules`).

### Critérios de aceite

- [ ] Nenhuma rota de plataforma documentada em `/admin` nesses controllers
- [ ] `@RolesAuth(Roles.SUPER_ADMIN)` em todos eles

### Não fazer

- Não manter dual `/admin` + `/platform`
- Não mover `push-subscriptions` aqui

---

## 3.2 — Primeiro user só

### O que fazer

Em `UsersService.create` quando chamado pelo controller platform: `count` users do tenant; se `> 0`, `ForbiddenException`. GET list permanece. Remover do controller platform: `PATCH :userId` e `POST :userId/reset-password` (vão para `/tenant` no grupo 4). Continuar `rejectSuperAdmin` em create.

### Critérios de aceite

- [ ] Segundo POST `/platform/tenants/:id/users` → 403
- [ ] Tenant zerado ainda cria ADMIN

### Não fazer

- Não permitir `SUPER_ADMIN` no body

---

## 3.3 — Outreach platform fields

### O que fazer

- `GET /platform/tenants/:tenantId/outreach-config` — mesmo include atual (templates mínimos).
- `PATCH` DTO só `costPerLead?`, `cashbackOnReply?`. Se body tiver campos tenant-owned (mesmo extra), 403.
- `PUT` só se **não existe** row: pode aceitar body completo (bootstrap) usando helper do grupo 2; se já existe, 403 (Admin usa PATCH operacional).
- Se Super Admin PATCH `leadsPerRun` após janela → 403.

Separar DTOs: não reusar `PatchOutreachConfigDto` inteiro no platform controller.

`enabled=true` **não** é mais ação deste controller (exceto bootstrap PUT).

### Critérios de aceite

- [ ] PATCH preço após janela 200
- [ ] PATCH knobs após janela 403
- [ ] PUT quando já existe 403

### Não fazer

- Não apagar validação de campos legado (`rejectLegacyOutreachFields`)

---

## 3.4 — costPerSend na plataforma

### O que fazer

Novo endpoint `PATCH /platform/tenants/:tenantId/lead-lists/:listId` com `{ costPerSend: number }` `@Min(0)`. Negativo 400. Não criar lista aqui.

### Critérios de aceite

- [ ] Admin neste path 403
- [ ] Valor 0 persistido (cron já skipa `<= 0` em `list-campaigns.service.ts` `runCampaign`)

### Não fazer

- Não exigir `costPerSend > 0` neste PATCH (0 = sem envio)

---

## 3.5 — 403 para ADMIN em /platform

### O que fazer

Smoke: JWT só `ADMIN` em `GET /platform/tenants` → 403; sem token → 401. `RolesGuard` já faz isso se `@RolesAuth(SUPER_ADMIN)`.

### Critérios de aceite

- [ ] ADMIN 403; unauthenticated 401; SUPER_ADMIN 200

### Não fazer

- Não abrir `/platform` para ADMIN “read-only” (leitura operacional é `/tenant` GET, grupo 4)

---

## Verificação do grupo

Swagger lista tags Platform. Login Super Admin exercita GET tenants no path novo.

## Handoff para próxima task

`/admin` operacional ainda pode existir até o grupo 4 mover. Grupo 4 não deve deixar controllers duplicados no final — remover `@Controller('admin/tenants/:tenantId/lead-lists')` ao mover.
