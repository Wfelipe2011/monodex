# Task 3 — Notifly — crons sem débito + reserva

**Change:** `configurable-coin-debit-on-status`
**Grupo:** 3 de 5
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-notifly-servico-de-debito-estorno.md)
**Desbloqueia:** [task-05](./task-05-backfill-retroativo-e-verificacao.md)

## Objetivo do grupo

Parar de debitar no Graph 200 (cidade e lista), reservar saldo de envios pendentes, e reabrir seleção de phones de cidade com `lastStatus=failed`.

## Contexto para o subagent

- Cidade: `apps/notifly/src/leads.service.ts`
  - Débito atual ~linhas 461–483 (dentro da transaction pós-Graph).
  - Affordable: `floor(balance / costPerLead)` ~274–289.
  - Used phones: `tenantLead.findMany({ where: { tenantId } })` ~291–299 — **qualquer** row exclui o phone.
- Lista: `apps/notifly/src/list-campaigns.service.ts`
  - Débito ~280–300 em `sendToLead`.
  - Affordable no `runCampaign` (balance / costPerSend).
  - Unlock failed já existe via webhook (task 2 reforça refund).
- Specs: `cloud-outreach-runtime`, `tenant-list-campaigns`, `coin-debit-on-status` (reserva + Graph sem débito).
- Design D4 (reserva) e D5 (exclusão failed).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/leads.service.ts` | editar |
| `apps/notifly/src/list-campaigns.service.ts` | editar |
| specs/testes novos ou existentes dos serviços | criar/editar se o repo já tiver padrão; senão smoke manual documentado |

---

## 3.1 — Cidade: sem débito + reserva

### O que fazer

1. Remover `coin.update` / `coinTransaction.create` do bloco pós-sucesso em `contactLeads`.
2. Calcular:
   ```
   pending = count TenantLead where tenantId=T
     AND coinDebitedAt IS NULL
     AND (lastStatus IS NULL OR lastStatus != failed)
   available = balance - pending * costPerLead
   affordable = floor(available / costPerLead)
   ```
3. Manter criação de `TenantLead` com `contacted: true`, `messageId`, `templateName` como hoje; `coinDebitedAt` permanece null.

### Critérios de aceite

- [x] Graph 200 não altera `Coin.balance`
- [x] Com 1 pending e saldo de 1 lead, cron não envia outro
- [x] `TenantLead` continua sendo criado no sucesso Graph

### Não fazer

- Não remover cashback em `responseLeads`
- Não debitar aqui “por garantia”

---

## 3.2 — Lista: sem débito + reserva

### O que fazer

1. Remover débito em `sendToLead`.
2. No cálculo de batch do `runCampaign`, pending = `TenantListSend` da **lista** (via campaigns da list) com `coinDebitedAt` null e `lastStatus` ≠ failed; `available = balance - pending * costPerSend`.

### Critérios de aceite

- [x] Graph 200 lista não debita
- [x] Reserva reduz `sendsPerRun` efetivo
- [x] Lock do lead no Graph 200 permanece

### Não fazer

- Não mudar button actions / notify sem cashback

---

## 3.3 — Exclusão de phones cidade

### O que fazer

Trocar used-phones para excluir apenas leads que **não** estão failed, por exemplo:

```ts
where: {
  tenantId: tenant.id,
  OR: [
    { lastStatus: null },
    { lastStatus: { not: WhatsappDeliveryStatus.failed } },
  ],
}
```

(Ajuste Prisma idiomático equivalente: `NOT lastStatus = failed`, cuidando NULL — em SQL `IS DISTINCT FROM failed`.)

### Critérios de aceite

- [x] `lastStatus=failed` não entra na lista de phones excluídos
- [x] `lastStatus=null` (pendente) continua excluído
- [x] `delivered`/`sent`/`read` continuam excluídos

### Não fazer

- Não apagar rows failed
- Não alterar exclusões de `TenantSendPolicy` além do efeito via `contacted` (task 2 já seta `contacted=false`)

---

## 3.4 — Testes / verificação

### O que fazer

Se não houver spec dos crons, adicionar testes unitários focados nas funções de affordable/exclusão (extrair helpers puros se facilitar). Caso contrário, documentar checklist manual no handoff da task 5.

### Critérios de aceite

- [x] Cobertura mínima: no debit on send; pending reservation; failed phone not excluded

### Não fazer

- Não chamar Graph real nos testes

---

## Verificação do grupo

- Revisar diff: zero `coin.update` decrement em `contactLeads` / `sendToLead`.
- Simular contagens pending vs balance.

## Handoff para próxima task

Runtime alinhado ao modelo novo. Task 4 expõe config na API; task 5 backfill do legado.
