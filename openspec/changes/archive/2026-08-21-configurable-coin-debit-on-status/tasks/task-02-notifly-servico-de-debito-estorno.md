# Task 2 — Notifly — serviço de débito/estorno

**Change:** `configurable-coin-debit-on-status`
**Grupo:** 2 de 5
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-03](./task-03-notifly-crons-sem-debito-reserva.md), [task-05](./task-05-backfill-retroativo-e-verificacao.md)

## Objetivo do grupo

Centralizar cobrança/estorno idempotente no webhook de status (cidade e lista), incluindo reopen de cidade em `failed`.

## Contexto para o subagent

- App: `apps/notifly` (NestJS). Module: `apps/notifly/src/notifly.module.ts` — registrar o novo provider.
- Webhook atual: `apps/notifly/src/webhook-persistence.service.ts` → `handleStatus`:
  - cria `WhatsappSendStatus`
  - atualiza `TenantListSend.lastStatus` + unlock se `failed`
  - atualiza `TenantLead.lastStatus`
  - **hoje não toca coins**
- Spec existente: `apps/notifly/src/webhook-persistence.service.spec.ts` (padrão de mocks Prisma).
- Custos: cidade = `TenantOutreachConfig.costPerLead`; lista = `TenantLeadList.costPerSend` via `listSend → listLead → list`.
- Gatilho: `TenantOutreachConfig.coinDebitOnStatus` do tenant; se config ausente → `delivered`.
- Rank (design D2): `sent=1`, `delivered=2`, `read=3`. Cobrar se `rank(status) >= rank(trigger)` e status ≠ failed.
- Carteira: padrão atual dos crons — `coin.findFirst({ tenantId })` + `userId` da carteira / primeiro user do tenant. **Replicar o mesmo critério** do débito legado em `leads.service` / `list-campaigns.service` para não mudar ownership da wallet.
- Design: `openspec/changes/configurable-coin-debit-on-status/design.md` (D2–D6).
- Specs: `specs/coin-debit-on-status/spec.md`, `specs/whatsapp-send-status/spec.md`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/coin-debit-on-status.service.ts` (nome livre, preferir este) | criar |
| `apps/notifly/src/coin-debit-on-status.service.spec.ts` | criar |
| `apps/notifly/src/webhook-persistence.service.ts` | editar |
| `apps/notifly/src/webhook-persistence.service.spec.ts` | editar |
| `apps/notifly/src/notifly.module.ts` | editar |

---

## 2.1 — Serviço compartilhado

### O que fazer

Criar serviço injetável com métodos do tipo:

- `applyAfterStatus({ tenantId, status, tenantLeadId?, listSendId? })`
- Internamente:
  1. Carregar send (`TenantLead` ou `TenantListSend` + cost + config).
  2. Se `failed` → `refundIfNeeded` (+ caller cuida reopen/unlock, ou o serviço seta `contacted=false` na cidade).
  3. Senão se rank ok e `coinDebitedAt == null` → debit + set `coinDebitedAt`.
  4. Tudo em `$transaction` quando mutar coin + timestamps.

Description das transactions: incluir `wamid=...` e origem `city`/`list`.

### Critérios de aceite

- [ ] Débito só com rank ≥ gatilho
- [ ] `read` debita se gatilho `delivered` e ainda não debitado
- [ ] Segunda chamada não debita de novo
- [ ] Failed sem débito prévio: no-op de coin
- [ ] Failed com débito: um `CREDITO` + `coinRefundedAt`

### Não fazer

- Não debitar no Graph send (isso é task 3 — remover)
- Não mudar cashback de reply

---

## 2.2 — Integrar em handleStatus

### O que fazer

Ao final de `handleStatus`, depois de persistir status e atualizar `lastStatus`/unlock lista, chamar o serviço com o tenant resolvido (lista: `list.tenantId`; cidade: `tenantLead.tenantId`).

Ordem sugerida: persist status → update lastStatus → unlock lista se failed → billing → (cidade failed: contacted=false pode estar no billing ou aqui).

### Critérios de aceite

- [ ] Lista `delivered` debita quando gatilho default
- [ ] Cidade `delivered` debita
- [ ] Failed lista: unlock **e** refund se aplicável
- [ ] Erro de billing não deve corromper o append do status (preferir try/log ou mesma transaction consciente — documentar escolha; preferir mesma transaction com o update do send)

### Não fazer

- Não alterar `handleInboundMessage`

---

## 2.3 — Failed cidade reabre

### O que fazer

Em failed de `TenantLead`: `contacted: false` (além de `lastStatus=failed`). Não apagar a row nem limpar `messageId` (histórico).

A exclusão de phones no cron (task 3) completa o reopen; aqui só o flag + billing.

### Critérios de aceite

- [ ] Spec/teste: failed cidade seta `contacted=false`
- [ ] Failed lista **não** chama update de `TenantLead.contacted`

### Não fazer

- Não deletar `TenantLead`

---

## 2.4 — Testes

### O que fazer

- Unit tests do serviço: matriz gatilho × status; idempotência; refund.
- Estender `webhook-persistence.service.spec.ts` com casos de coin mock (debit/refund/reopen).

### Critérios de aceite

- [ ] Testes passam
- [ ] Cobrem pelo menos: delivered debita; sent não debita (gatilho delivered); failed refund; idempotência

### Não fazer

- Não depender de Meta real

---

## Verificação do grupo

```bash
# a partir da raiz / apps/notifly conforme package scripts do monorepo
npx jest apps/notifly/src/coin-debit-on-status.service.spec.ts
npx jest apps/notifly/src/webhook-persistence.service.spec.ts
```

## Handoff para próxima task

Webhook já cobra/estorna. Crons ainda debitam no Graph 200 — task 3 remove isso e adiciona reserva (senão double-charge em produção se deploy parcial; deploy deve incluir task 2+3 juntos).
