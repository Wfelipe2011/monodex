# Task 4 — Mídia — upload, listagem, GET público e cron de órfãos

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 4 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-hash-de-chave-e-authguard-dual-mode.md)
**Desbloqueia:** [task-05](./task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md), [task-07](./task-07-agendas-api-e-worker-horario.md)

## Objetivo do grupo

Tenant (JWT ou chave) sobe/lista imagens; GET público por UUID; cron configurável no gym-ctrl apaga arquivos sem row.

## Contexto para o subagent

- gym-ctrl **não** tem `ScheduleModule` hoje (`apps/gym-ctrl/src/gym.module.ts`). Captura: `apps/captura/src/captura.module.ts` + `dynamic-scrape-cron.service.ts` (poll 60s, `CronJob.from`, `PlatformJobKey.SCRAPE`).
- `@Public()`: `libs/decorators/public.decorator.ts` — ver `public-invites.controller.ts`.
- Joi env em `gym.module.ts`: adicionar `PUBLIC_API_BASE_URL` (required em production, optional em test/dev) e `TENANT_MEDIA_DIR` optional default `uploads/tenant-media`.
- `@ApiKeyAllowlist()` do grupo 2 nos POST/GET autenticados de mídia (**não** no GET público).
- Super Admin POST 403 (checar `Roles.SUPER_ADMIN` como em `conversations.controller.ts` sendTextMessage). GET list permitido.
- FileInterceptor / diskStorage do `@nestjs/platform-express`. MIME allowlist jpeg/png/webp. Max 5 MB (`limits.fileSize`).
- URL Graph (grupo 5) = `${PUBLIC_API_BASE_URL}/public/media/${publicId}` — expor helper `publicMediaUrl(publicId)` no service.
- Job seed já existe após grupo 1. Controller platform de jobs (`platform-job-schedules.controller.ts`) já PUT qualquer `PlatformJobKey` do enum — atualizar a description que hoje diz “WHATSAPP_TEMPLATE_SYNC ou SCRAPE”.
- Disco: path relativo no banco; files **no processo gym-ctrl**.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/gym.module.ts` | editar (ScheduleModule, Joi, provider cron) |
| `apps/gym-ctrl/src/modules/admin/media.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/public-media.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/media.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/orphan-media-cleanup.cron.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/platform-job-schedules.controller.ts` | editar description |
| testes colocalizados | criar |

---

## 4.1 — Upload e list autenticados

### O que fazer

`POST /tenant/:tenantId/media` multipart field `file`. Roles ADMIN+SUPER_ADMIN; Super Admin 403 no POST. `@ApiKeyAllowlist`. `@UseGuards(TenantScopeGuard, TenantActiveGuard)`.

Salvar em `{TENANT_MEDIA_DIR}/{tenantId}/{uuid}.{ext}`; row `TenantMedia`. 201: `{ id, publicId, originalFileName, mimeType, byteSize, createdAt }` **sem** `relativePath`.

`GET /tenant/:tenantId/media` lista do tenant, `createdAt` desc.

MIME inválido / >5 MB → 400, sem row.

### Critérios de aceite

- [ ] Admin e API key sobem; Super Admin POST 403
- [ ] List não vaza path nem mídia de outro tenant

### Não fazer

- Não aceitar PDF/SVG
- Não servir o arquivo neste path autenticado (isso é o público)

---

## 4.2 — GET público

### O que fazer

`GET /public/media/:publicId` `@Public()`, sem roles. 200 stream/buffer + `Content-Type` da row. 404 se id desconhecido. Não exigir UUID format rígido demais se o Prisma uuid() já gera string.

Não logar o arquivo inteiro.

### Critérios de aceite

- [ ] Sem Authorization → 200 se existe
- [ ] Id inexistente → 404

### Não fazer

- Não usar `:id` sequencial na URL pública

---

## 4.3 — Cron de órfãos

### O que fazer

Copiar o padrão `DynamicScrapeCronService`: `jobKey: ORPHAN_MEDIA_CLEANUP`, fallback `{ cronExpression: '0 3 1,16 * *', timeZone: 'America/Sao_Paulo', enabled: true }`. Tick: `readdir` recursivo (ou por tenantId) do media dir; para cada arquivo, se nenhum `TenantMedia.relativePath` bate (normalizar path POSIX vs win32) → `unlink`. Não apagar rows.

`ScheduleModule.forRoot()` no `GymModule`.

Disabled no banco → não agenda (igual scrape).

### Critérios de aceite

- [ ] Arquivo sem row some; arquivo com row permanece
- [ ] `enabled=false` não dispara

### Não fazer

- Não rodar este job no notifly
- Não apagar o diretório inteiro se o banco estiver vazio e o dir tiver só lixo — apagar arquivo a arquivo é o esperado (órfãos)

---

## 4.4 — Testes

### O que fazer

Service: save+list scope; reject mime/size; publicUrl helper; cleanup orphan vs referenced (usar tmp dir). Controller metadata `@Public()` no GET público (espelhar invites).

### Critérios de aceite

- [ ] Specs passam sem depender de disco de produção

### Não fazer

- Não chamar Graph

---

## Verificação do grupo

Upload → GET público 200; arquivo lixo no dir some no cleanup unitário.

## Handoff para próxima task

`MediaService.publicUrl` / lookup por `publicId`+`tenantId` prontos para o send preencher `header.image`.
