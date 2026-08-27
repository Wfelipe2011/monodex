# Task 4 — List campaigns — abrir run e Graph-fail refill

**Change:** `outreach-quota-refill-on-failure`
**Grupo:** 4 de 6
**Pré-requisitos:** [1](./task-01-schema-e-migration.md), [2](./task-02-servico-de-run-e-refill-notifly.md)
**Desbloqueia:** [6](./task-06-verificacao-e-handoff.md)

## Objetivo do grupo

Espelhar o comportamento de run/refill nas list campaigns: `sendsPerRun` como target, Graph-fail repõe outro list lead, sem premium mix.

## Contexto para o subagent

- `apps/notifly/src/list-campaigns.service.ts` — `runCampaign` (~L146), loop ~L174, `sendToLead` ~L202.
- Eligible leads / locks: `findEligibleLeads`, unlock on failed já no webhook.
- Spec: `../specs/tenant-list-campaigns/spec.md`, `../specs/outreach-send-run/spec.md`.
- Sem `TenantSendPolicy` city filters.
- DI: injetar os mesmos run/refill services.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/list-campaigns.service.ts` | editar |
| `apps/notifly/src/list-campaigns.service.spec.ts` (se houver) / novo | editar/criar |

---

## 4.1 — openListRun + link runId

### O que fazer

- Após affordable/eligible: `openListRun({ tenantId, campaignId, targetCount: campaign.sendsPerRun })`; skip se null.
- Antes de cada POST: `beginTry`.
- Em sucesso em `sendToLead`: persistir `TenantListSend` com `runId`; `recordAccept`.
- Deixar run OPEN ao fim do tick para webhook.

### Critérios de aceite

- [ ] List sends do tick têm `runId`
- [ ] Campanha com run OPEN não inicia segundo batch

### Não fazer

- Não criar `TenantLead` no path de lista

---

## 4.2 — Graph-fail refill

### O que fazer

Mesma estratégia do city (while unificado **ou** catch → `refillOne` com `failedListLeadId`).

- Excluir list leads já aceitos no run + o que acabou de falhar.
- Respeitar `sendIntervalSeconds` e locks.

### Critérios de aceite

- [ ] Um Graph fail não reduz permanentemente o número de accepts do tick se houver elegíveis
- [ ] Refill não reusa o mesmo `listLeadId` naquele evento

### Não fazer

- Não aplicar regras premium

---

## 4.3 — Testes

### O que fazer

- Mock Graph fail mid-batch → ainda alcança target accepts.
- Cap try `sendsPerRun * 3`.
- Skip quando OPEN run existe.

### Critérios de aceite

- [ ] Specs passam

### Não fazer

- Não testar on-demand

---

## Verificação do grupo

- List path alinhado ao city em counters/TTL/skip.

## Handoff para próxima task

Grupo 5 conecta `failed` webhook + debit/refund aos counters do run para city **e** list.
