# Task 5 — Webhook failed + billing hooks

**Change:** `outreach-quota-refill-on-failure`
**Grupo:** 5 de 6
**Pré-requisitos:** [1](./task-01-schema-e-migration.md), [2](./task-02-servico-de-run-e-refill-notifly.md) (3–4 recomendados para sends com runId reais)
**Desbloqueia:** [6](./task-06-verificacao-e-handoff.md)

## Objetivo do grupo

Debit incrementa `chargedCount`; refund por `failed` reverte crédito da cota; primeiro `failed` de um send com `runId` dispara **um** `refillOne` de forma async e idempotente.

## Contexto para o subagent

- `apps/notifly/src/webhook-persistence.service.ts` → `handleStatus` (~L131): append status, update lastStatus, unlock/reopen, depois `coinDebitOnStatus.applyAfterStatus`.
- `apps/notifly/src/coin-debit-on-status.service.ts` → `applyAfterStatus`, `debitIfDue`, `refundIfNeeded`.
- Specs: `../specs/coin-debit-on-status/spec.md`, `../specs/outreach-send-run/spec.md`.
- Design D4/D9: one failed → one refill; sleep interval sem bloquear ACK Meta (fire-and-forget).
- City reopen `contacted=false` e list unlock **já existem** — preservar ordem: billing/refund → depois refill hook.
- On-demand: sem runId → sem refill.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/coin-debit-on-status.service.ts` | editar |
| `apps/notifly/src/webhook-persistence.service.ts` | editar |
| `apps/notifly/src/coin-debit-on-status.service.spec.ts` | editar |
| `apps/notifly/src/webhook-persistence.service.spec.ts` (se existir) | editar/criar |
| `apps/notifly/src/notifly.module.ts` | editar DI |

---

## 5.1 — Debit → chargedCount

### O que fazer

Após débito bem-sucedido (quando `coinDebitedAt` é setado pela primeira vez) em city/list com `runId`:

- `OutreachSendRunService.recordCharge(runId)`
- Pode fechar `TARGET_MET`

Carregar `runId` no find do send dentro da transaction de debit, ou re-fetch após debit.

### Critérios de aceite

- [ ] Debit de send com runId incrementa `chargedCount`
- [ ] On-demand debit não toca runs
- [ ] Atingir target fecha o run

### Não fazer

- Não mudar ranks de trigger `sent/delivered/read`

---

## 5.2 — Failed refund + refill at-most-once

### O que fazer

Em path `failed`:

1. Refund existente (inalterado semanticamente).
2. Se havia `coinDebitedAt` e refund ocorreu → `recordChargeReversal(runId)`.
3. Se send tem `runId` e `refillTriggeredAt` null:
   - Marcar `refillTriggeredAt`
   - `void refillService.refillOne(...).catch(log)` **sem await** no hot path do webhook (ou await só o mark + schedule)
4. Passar `failedPhone` / `wasPremium` / `failedListLeadId` conforme canal.

Duplicate Meta `failed`: `refillTriggeredAt` já set → no second refill.

### Critérios de aceite

- [ ] Dois failed events em dois sends → dois refillOnes
- [ ] Redelivery do mesmo failed → um refill
- [ ] `runId` null → só refund/reopen

### Não fazer

- Não refill em on-demand
- Não lançar erro para o controller do webhook

---

## 5.3 — Async + testes

### O que fazer

- Garantir que o HTTP handler do webhook não espera o sleep do intervalo de refill.
- Extender `coin-debit-on-status.service.spec.ts` com casos de charge/reversal.
- Teste de idempotência `refillTriggeredAt`.

### Critérios de aceite

- [ ] Specs billing + refill hook passam
- [ ] Comentário/log claros no fire-and-forget

### Não fazer

- Não introduzir broker externo (Redis/SQS) neste change

---

## Verificação do grupo

- Fluxo: accept → delivered debit → charged++; failed → reversal + 1 refill.

## Handoff para próxima task

Grupo 6 só verifica E2E/checklist e fecha tasks.md.
