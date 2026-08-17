# Task 3 — Admin — WhatsApp account e job schedules

**Change:** `meta-whatsapp-template-catalog`
**Grupo:** 3 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** 4, 8

## Objetivo do grupo

API SUPER_ADMIN persiste `wabaId` na conta plataforma e CRUD dos crons `WHATSAPP_TEMPLATE_SYNC` / `SCRAPE`.

## Contexto para o subagent

- `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.controller.ts`
- `apps/gym-ctrl/src/modules/admin/whatsapp-accounts.service.ts` — `accountSelect` precisa incluir `wabaId`
- DTOs: `dto/create-whatsapp-account.dto.ts`, `dto/patch-whatsapp-account.dto.ts`
- `rejectSecretTokenFields` em `reject-secret-token-fields.ts` — continuar rejeitando token no body
- `RolesAuth(Roles.SUPER_ADMIN)` no controller
- `AdminModule` em `admin.module.ts`
- MVP: `tenantId` continua null; não abrir contas comerciais
- Seed de schedules já na migration (grupo 1); PUT só atualiza

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `create-whatsapp-account.dto.ts` / `patch-whatsapp-account.dto.ts` | editar |
| `whatsapp-accounts.service.ts` | editar |
| `dto/upsert-platform-job-schedule.dto.ts` | criar |
| `platform-job-schedules.controller.ts` | criar |
| `platform-job-schedules.service.ts` | criar |
| `admin.module.ts` | editar |

---

## 3.1 — wabaId na conta

### O que fazer

- Create: `wabaId` required, `@IsString` `@MinLength(1)`
- Patch: `wabaId` optional mesmas regras
- `accountSelect` + create/update `data` incluem `wabaId`
- GET/list devolvem `wabaId`
- Continuar `rejectNonNullTenantId`

### Critérios de aceite

- [ ] POST sem `wabaId` → 400
- [ ] GET inclui `wabaId`
- [ ] Resposta nunca inclui access token

### Não fazer

- Não listar templates Meta nesta task

---

## 3.2 — Job schedules

### O que fazer

`GET /admin/platform-job-schedules` — lista as duas rows.

`GET /admin/platform-job-schedules/:jobKey` — `WHATSAPP_TEMPLATE_SYNC` | `SCRAPE`; 404 se não existir.

`PUT /admin/platform-job-schedules/:jobKey` body:

```json
{ "cronExpression": "0 8 * * *", "timeZone": "America/Sao_Paulo", "enabled": true }
```

Validar cron de 5 campos (regex simples `^(\S+\s+){4}\S+$` ou lib já no repo; **não** adicionar dependência pesada se regex bastar). `timeZone` default `America/Sao_Paulo`. Upsert se a row faltar (dev sem migration seed).

SUPER_ADMIN + `ApiBearerAuth` + `ValidationPipe whitelist`.

Workers (captura/notifly) **não** são notificados; eles fazem poll (grupos 6 e 7).

### Critérios de aceite

- [ ] PUT cron inválido (string vazia / 4 campos) → 400
- [ ] GET após PUT devolve os valores novos
- [ ] jobKey desconhecido → 400

### Não fazer

- Não mudar `CapturaScraperService` aqui

---

## Verificação do grupo

Swagger tags novas; compile gym-ctrl.

## Handoff para próxima task

Conta tem `wabaId` para o sync Graph (grupo 4).
