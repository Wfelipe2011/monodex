# Task 6 — Notifly — billing on-demand, webhook e reserva unificada

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 6 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-05](./task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md) (send persiste wamid; reserva shared pode ser feita em paralelo após 1 se o helper já existir)
**Desbloqueia:** [task-07](./task-07-agendas-api-e-worker-horario.md), [task-08](./task-08-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Status Meta de on-demand liga na row certa, debita/estorna com `costPerOnDemandSend` no mesmo serviço de cidade/lista, e os crons reservam saldo cruzado.

## Contexto para o subagent

- `apps/notifly/src/webhook-persistence.service.ts` `handleStatus`: lookup `tenantListSend` por `wamid` e `tenantLead` por `messageId`; create `WhatsappSendStatus`; update `lastStatus`; `coinDebitOnStatus.applyAfterStatus({ tenantId, status, listSendId, tenantLeadId })`.
- Serviço: `apps/notifly/src/coin-debit-on-status.service.ts`. Early return se ambos ids null. Carteira: `resolveWalletUserId`. Description hoje `city wamid=` / `list wamid=`. Cost cidade: outreach `costPerLead`; lista: `list.costPerSend`.
- Reserva atual: `apps/notifly/src/coin-reservation.ts` `computeAffordableSends(balance, pendingCount, unitCost)` — **um** unit cost. Cidade em `leads.service.ts` ~288; lista em `list-campaigns.service.ts` (pending da lista).
- Fórmula nova: `available = balance - cityPending*costPerLead - listPending*costPerSend - onDemandPending*costPerOnDemandSend`. Affordable cidade = `floor(available / costPerLead)` (não misturar pending de outro canal no `pendingCount` do helper antigo sem adaptar). Preferir `computeAvailableBalance(...)` novo + `floor(available / unitCost)`.
- On-demand pending: `TenantOnDemandSend` onde `coinDebitedAt` null e `lastStatus` distinct from `failed` (inclui null).
- `CoinTransaction.userId` é obrigatório — reusar `resolveWalletUserId`; description `on_demand wamid=... onDemandSendId=...`. `leadId` null.
- Não alterar gatilho `coinDebitOnStatus`.
- Specs: `coin-debit-on-status.service.spec.ts`, `webhook-persistence.service.spec.ts` se existir.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/webhook-persistence.service.ts` | editar |
| `apps/notifly/src/coin-debit-on-status.service.ts` | editar |
| `apps/notifly/src/coin-debit-on-status.service.spec.ts` | editar |
| `apps/notifly/src/coin-reservation.ts` | editar |
| `apps/notifly/src/leads.service.ts` | editar (available unificado) |
| `apps/notifly/src/list-campaigns.service.ts` | editar (available unificado) |
| testes de reserva | editar/criar |

---

## 6.1 — Resolver wamid on-demand

### O que fazer

Em `handleStatus`, além de list/city: `tenantOnDemandSend.findUnique({ where: { wamid: status.id } })`. Persist `onDemandSendId` no create de `WhatsappSendStatus`. Atualizar `lastStatus` da row on-demand.

XOR: se casou on-demand, `listSendId` e `tenantLeadId` ficam null (e vice-versa). Se um wamid colidir entre canais (não deveria), log + preferir o match mais específico; não debitar duas vezes.

`billingTenantId` também de `onDemandSend.tenantId`. Chamar `applyAfterStatus` com `onDemandSendId`.

### Critérios de aceite

- [ ] Status delivered de wamid on-demand grava `onDemandSendId` e `lastStatus`
- [ ] Cidade/lista inalterados quando o wamid é deles

### Não fazer

- Não unlock de list lead para on-demand
- Não `contacted=false` de cidade para on-demand

---

## 6.2 — Debito/estorno on-demand

### O que fazer

Estender `ApplyAfterStatusArgs` com `onDemandSendId?`. Early return só se os **três** ids null.

`debitOnDemandSend` / `refundOnDemandSend` espelhando list: cost de `tenant.outreachConfig.costPerOnDemandSend` (default 0 → no-op débito, igual cost cidade ≤ 0). Idempotência `coinDebitedAt` / `coinRefundedAt`. Rank/trigger iguais.

Se `cost <= 0` no webhook (preço zerado depois do send): não debitar (send já aceito — edge; log warn).

### Critérios de aceite

- [ ] delivered com gatilho delivered debita `costPerOnDemandSend` uma vez
- [ ] failed antes do débito: no-op; failed depois: crédito uma vez
- [ ] Graph path (grupo 5) continua sem `coin.update`

### Não fazer

- Não debitar no notifly no momento do cron de agenda além deste webhook (grupo 7 só Graph + persist)

---

## 6.3 — Reserva unificada

### O que fazer

Helper que soma os três pendings × custos. `leads.service` e `list-campaigns.service` passam a usar `available` unificado. Gym-ctrl preflight (grupo 5) **deve** usar a mesma fórmula — se o helper ficou só no notifly, mover para `libs/shared` nesta task e ajustar grupo 5 se ainda não compartilhou.

On-demand POST já existente: se grupo 5 usou só `pendingOnDemand * costOnDemand`, alinhar agora para subtrair cidade/lista pending também.

### Critérios de aceite

- [ ] 1 on-demand pending reduz affordable de cidade (cenário do spec)
- [ ] Failed on-demand não reserva

### Não fazer

- Não mudar mix premium além do `affordable` de entrada

---

## 6.4 — Testes

### O que fazer

Serviço: debit/refund/idempotência on-demand. Webhook: XOR ids. Reserva: unidade pura + se possível service com prisma mock.

### Critérios de aceite

- [ ] Specs passam

### Não fazer

- Não backfill legado (canal novo)

---

## Verificação do grupo

Webhook sintético on-demand delivered → `DEBITO` + `coinDebitedAt`; failed sem débito prévio → saldo igual.

## Handoff para próxima task

Agenda (grupo 7) reutiliza persistência+Graph do send e billing deste grupo; worker só preflight + chamar o mesmo pipeline.
