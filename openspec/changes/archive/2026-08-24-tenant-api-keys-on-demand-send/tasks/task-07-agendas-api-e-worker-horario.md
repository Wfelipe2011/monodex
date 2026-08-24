# Task 7 — Agendas — API e worker horário

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 7 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-04](./task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md), [task-05](./task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md), [task-06](./task-06-notifly-billing-on-demand-webhook-e-reserva-unificada.md)
**Desbloqueia:** [task-08](./task-08-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Admin/chave agenda 1 dest + 1 template em data/hora SP; cancela se PENDING; notifly dispara na hora ou marca FAILED sem cobrança.

## Contexto para o subagent

- Cron dinâmico notifly: `apps/notifly/src/whatsapp-template-sync.service.ts` (poll + `PlatformJobKey.WHATSAPP_TEMPLATE_SYNC`). Novo worker igual, `ON_DEMAND_SCHEDULE_RUN`, fallback `0 * * * *` tz `America/Sao_Paulo`.
- Registrar provider em `apps/notifly/src/notifly.module.ts`.
- Send pipeline: extrair de `on-demand-sends.service.ts` (grupo 5) para shared **ou** duplicar o mínimo no notifly (Graph + persist send + thread) — **preferir** extrair função/serviço compartilhado em `libs/` se os dois apps já compartilham Prisma + platform whatsapp. Se platform whatsapp do gym-ctrl e notifly forem classes diferentes (`PlatformWhatsappAdminService` vs `PlatformWhatsappService`), o worker chama o serviço **notifly** (`resolveCredentials(tenantId)`) e persiste as mesmas tables. Não HTTP interno gym-ctrl→notifly.
- `scheduledFor`: converter date+hour SP → Date UTC do início daquela hora (`luxon`/`date-fns-tz` se já existir no repo; senão `Intl` / offset fixo documentado). Body sugerido: `{ templateId, to, scheduledFor: "2026-08-22T14:00:00" }` com timezone implícito SP (rejeitar minuto ≠ 0 se vier).
- Claim: `updateMany` where `id` + `status=PENDING` → `SENT` **depois** do Graph? Melhor: transação `PENDING` → lock (`SENT` só após wamid) usando status intermediário **não** existe no enum. Usar update condicional `PENDING` para processar: `updateMany({ where: { id, status: PENDING }, data: { status: SENT } })` **após** Graph 200 na mesma unidade; se Graph falhar, `FAILED`. Para concorrência: `updateMany` para um campo `claimedAt` **ou** `updateMany PENDING → SENT` só com wamid na mesma tx após insert send. Padrão simples: `findMany` due + `updateMany({ id, status: PENDING }, { status: SENT })` com count 1 antes do Graph — se count 0, skip (outro worker). Se Graph falhar depois do claim, marcar `FAILED` (pior: claim SENT cedo demais). **Decisão obrigatória:** claim atômico `PENDING` → processando via `updateMany` count; só então Graph; sucesso grava send e mantém SENT; falha Graph ou preflight → `FAILED` (não SENT). Sem status extra: fazer preflight **antes** do claim; claim+persist send+SENT numa tx após Graph 200; se dois workers, o segundo `updateMany` count 0.
- Cancel: `POST .../:id/cancel` só PENDING.
- Super Admin: GET list/get sim; POST/cancel 403.
- `@ApiKeyAllowlist` nas rotas de agenda (não cancel via chave? Design D8 diz chave **sim** CRUD). Super Admin write 403.
- Passado: comparar hora atual SP truncada vs `scheduledFor`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/on-demand-schedules.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/on-demand-schedules.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/dto/create-on-demand-schedule.dto.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | editar |
| `apps/notifly/src/on-demand-schedule-cron.service.ts` | criar |
| `apps/notifly/src/notifly.module.ts` | editar |
| testes gym-ctrl + notifly | criar |

---

## 7.1 — API de agendas

### O que fazer

`POST /tenant/:tenantId/on-demand-schedules` — snapshot `variables`/`imageId`/`leadId`/`templateId`/`to`. Validar template granted na **criação** (fail-fast); a hora H revalida. 201 com id, `scheduledFor` ISO UTC, status PENDING.

`GET /` e `GET /:id`. `POST /:id/cancel`.

### Critérios de aceite

- [ ] Passado 400; futuro PENDING
- [ ] Super Admin POST 403; GET 200
- [ ] Cancel PENDING ok; SENT 409

### Não fazer

- Não disparar Graph no POST da agenda
- Não granularidade de minuto (truncar para hora)

---

## 7.2 — Worker horário

### O que fazer

Job dinâmico `ON_DEMAND_SCHEDULE_RUN`. Cada tick: agendas `PENDING` com `scheduledFor <= now`. Reusar envio Graph + persist `TenantOnDemandSend` `source=SCHEDULE` + thread (grupo 5 regras). `onDemandSendId` na agenda. Disabled no `PlatformJobSchedule` → não roda.

### Critérios de aceite

- [ ] Due + preflight ok → uma mensagem Graph e status SENT
- [ ] Futuro não envia
- [ ] Dois ticks não enviam duas vezes (claim)

### Não fazer

- Não debitar no worker (webhook grupo 6)

---

## 7.3 — Preflight na hora H

### O que fazer

Antes do Graph: tenant `active`, template ainda granted + APPROVED, dedicado, `costPerOnDemandSend > 0`, mídia ainda existe se `imageId`, `available >= cost` (fórmula grupo 6). Qualquer falha: `status=FAILED`, `failedReason` string curta, sem Graph, sem row send cobrável.

### Critérios de aceite

- [ ] Saldo insuficiente → FAILED, coins iguais
- [ ] Grant revogado → FAILED
- [ ] Imagem apagada → FAILED

### Não fazer

- Não requeue automático

---

## 7.4 — Testes

### O que fazer

Service API: timezone, cancel, Super Admin. Worker: mock Graph; casos due/skip/fail preflight/claim duplo.

### Critérios de aceite

- [ ] Specs passam

### Não fazer

- Não depender do relógio wall-clock sem fake timers

---

## Verificação do grupo

Criar agenda futura; worker com `scheduledFor` no passado dispara uma vez; preflight fail não cria `TenantOnDemandSend`.

## Handoff para próxima task

Contratos HTTP estáveis para Postman/FRONT-INTEGRATION.
