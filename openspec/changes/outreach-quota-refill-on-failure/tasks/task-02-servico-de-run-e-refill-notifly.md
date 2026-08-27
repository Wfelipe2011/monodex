# Task 2 — Serviço de run e refill (notifly)

**Change:** `outreach-quota-refill-on-failure`
**Grupo:** 2 de 6
**Pré-requisitos:** [1](./task-01-schema-e-migration.md)
**Desbloqueia:** [3](./task-03-city-outreach-abrir-run-e-graph-fail-refill.md), [4](./task-04-list-campaigns-abrir-run-e-graph-fail-refill.md), [5](./task-05-webhook-failed-billing-hooks.md)

## Objetivo do grupo

Centralizar open/close/TTL/contadores e `refillOne` (elegibilidade + intervalo + seleção), com testes unitários, sem ainda plugar o loop completo de city/list (hook mínimo OK).

## Contexto para o subagent

- App: `apps/notifly` (NestJS + Prisma).
- Registrar providers em `apps/notifly/src/notifly.module.ts`.
- Balance: `apps/notifly/src/coin-reservation.ts` — `loadCrossChannelPending`, `computeAvailableBalance`, `affordableFromAvailable`.
- Premium: `apps/notifly/src/premium-mix.ts` — `isPremium`, `computeY`, `selectStratifiedBatch`.
- City send loop atual: `apps/notifly/src/leads.service.ts` → `contactLeads`.
- List: `apps/notifly/src/list-campaigns.service.ts` → `runCampaign` / `sendToLead`.
- Specs: `../specs/outreach-send-run/spec.md`, `../specs/premium-lead-mix/spec.md`.
- Design D3–D9: try cap `target*3`, one failure → one refill, phone exclusion, interval, premium prefer.
- Refill Graph POST pode delegar a callbacks injetados (`sendCityLead`, `sendListLead`) para evitar circular DI — ou métodos públicos finos nos services existentes.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/outreach-send-run.service.ts` | criar |
| `apps/notifly/src/outreach-quota-refill.service.ts` | criar |
| `apps/notifly/src/outreach-send-run.service.spec.ts` | criar |
| `apps/notifly/src/outreach-quota-refill.service.spec.ts` | criar |
| `apps/notifly/src/notifly.module.ts` | editar |

---

## 2.1 — OutreachSendRunService

### O que fazer

API sugerida:

- `openCityRun({ tenantId, targetCount })` → fecha TTL expirados; se já existe OPEN não-expirado para CITY+tenant, return `null` (caller skip); senão cria com `expiresAt = now+1h`.
- `openListRun({ tenantId, campaignId, targetCount })` — análogo por campaign.
- `closeIfExpired(runId)` / `ensureOpen(run)` — se `now >= expiresAt` → `CLOSED` + `TTL`.
- `beginTry(runId)` — transaction lock row; se !OPEN / expired / tryCount>=target*3 / chargedCount>=target → return false; senão `tryCount++`.
- `recordAccept(runId)` → `attemptCount++`.
- `recordCharge(runId)` → `chargedCount++`; se `>= target` close `TARGET_MET`.
- `recordChargeReversal(runId)` → `chargedCount = max(0, chargedCount-1)` (refund path).
- `close(runId, reason)` — `EXHAUSTED` | `ATTEMPT_CAP` | etc.
- Usar `$transaction` + update condicional para evitar race.

### Critérios de aceite

- [x] Skip segundo OPEN city/list conforme spec
- [x] Cap `tryCount >= target*3` impede novos tries
- [x] Charge até target fecha `TARGET_MET`

### Não fazer

- Não chamar Graph daqui
- Não alterar webhook ainda

---

## 2.2 — OutreachQuotaRefillService.refillOne

### O que fazer

`refillOne(args)`:

```ts
{
  runId: number;
  // city:
  failedPhone?: string;
  wasPremium?: boolean;
  // list:
  failedListLeadId?: number;
  // mark idempotency on originating send:
  sourceTenantLeadId?: number;
  sourceListSendId?: number;
}
```

Fluxo:

1. Se `source*` e `refillTriggeredAt` já setado → return.
2. Set `refillTriggeredAt` atomically (updateMany where null).
3. `ensureOpen` / TTL / charged / try cap / balance.
4. Sleep `sendIntervalSeconds` (config city ou campaign).
5. Pick next lead:
   - City: excluir phones do run (accepts) + `failedPhone`; se `wasPremium`, prefer premium pool.
   - List: eligible unlocked ≠ `failedListLeadId`, excluindo list leads já enviados neste run.
6. `beginTry`; se ok, chamar sender; on 200 `recordAccept` + persist `runId`; on fail leave try counted (no second nested refill from this call—caller/webhook will event again only for new failures).

Graph-fail **during** refill: não chama `refillOne` recursivo; o loop do cron ou um novo evento trata.

### Critérios de aceite

- [x] Um `refillOne` por source send (idempotente)
- [x] Respeita intervalo e balance
- [x] Premium preferido quando `wasPremium` e pool existe

### Não fazer

- Não fan-out N refills por déficit
- Não incluir on-demand

---

## 2.3 — Testes unitários

### O que fazer

Specs com Prisma mock (padrão dos `*.spec.ts` em notifly):

- open skip when OPEN exists
- TTL close blocks refill
- try cap 15 for target 5
- charged target closes
- refill idempotent on `refillTriggeredAt`
- city excludes failed phone
- premium→premium when available

### Critérios de aceite

- [x] Specs passam (`npx jest` / comando do package notifly no monorepo)

### Não fazer

- Não exigir Meta real

---

## Verificação do grupo

- Providers no module; unit tests verdes.

## Handoff para próxima task

Grupos 3–4 ligam `contactLeads` / `runCampaign` a `open*` + `beginTry` + Graph-fail → `refillOne`. Grupo 5 liga debit/refund/failed.
