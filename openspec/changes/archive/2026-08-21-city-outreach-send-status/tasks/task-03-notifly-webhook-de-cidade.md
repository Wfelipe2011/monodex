# Task 3 — Notifly — webhook de cidade

**Change:** `city-outreach-send-status`
**Grupo:** 3 de 5
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-05](./task-05-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

`handleStatus` passa a amarrar eventos Meta a `TenantLead` quando o `wamid` é de outreach de cidade, atualiza `lastStatus`, e **não** mistura com unlock/lock de lista.

## Contexto para o subagent

- Serviço: `apps/notifly/src/webhook-persistence.service.ts`
- `handleStatus` hoje (~91–136):
  1. `toDeliveryStatus`; unknown → skip
  2. `tenantListSend.findUnique({ where: { wamid: status.id } })`
  3. `whatsappSendStatus.create` com `listSendId: send?.id ?? null`
  4. Se não achou send → **return** (cidade some aqui)
  5. Senão update `lastStatus` + unlock `tenantListLead.sendLockCampaignId` se `failed`
- Controller `apps/notifly/src/notifly.controller.ts` já itera `value.statuses` e chama `handleStatus` — **não** precisa mudar o loop.
- Interface `Status`: `apps/notifly/src/interfaces.ts` (`id` = wamid, `status`, `timestamp`, `recipient_id`). Status `deleted` **não** está no enum Prisma — `toDeliveryStatus` já retorna null.
- Spec existente: `apps/notifly/src/webhook-persistence.service.spec.ts` cobre só inbound. Estender o mock Prisma com `whatsappSendStatus.create`, `tenantListSend.update`, `tenantListLead.update`, `tenantLead.findUnique`/`findFirst` e `tenantLead.update`.
- Após unique da task 1, preferir `tenantLead.findUnique({ where: { messageId: status.id } })`.
- Inbound `resolveCorrelation` já busca `TenantLead` por `messageId` — **não** alterar o fluxo de mensagens nesta task.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/webhook-persistence.service.ts` | editar |
| `apps/notifly/src/webhook-persistence.service.spec.ts` | editar |

---

## 3.1 — Correlacionar cidade em handleStatus

### O que fazer

Em `handleStatus`, depois do map de enum:

1. Lookup lista: `tenantListSend.findUnique({ where: { wamid: status.id } })` (igual hoje).
2. Lookup cidade: `tenantLead.findUnique({ where: { messageId: status.id } })` (ou `findFirst` se unique ainda não estiver no client — mas a task 1 já unique).
3. `whatsappSendStatus.create`:
   - `listSendId: listSend?.id ?? null`
   - `tenantLeadId: tenantLead?.id ?? null`
   - resto igual (`wamid`, `status`, `metaTimestamp`, `recipientId`, `errors`)
4. Se `listSend`: update `TenantListSend.lastStatus`; se `failed`, unlock `tenantListLead` — **idêntico** ao código atual.
5. Se `tenantLead`: `tenantLead.update({ where: { id }, data: { lastStatus: deliveryStatus } })`.
6. City `failed` **não** chama `tenantListLead.update`.
7. Se nenhum dos dois: ainda persiste o status row (já acontece) com ambos FKs null; não return antes do create.

Não criar `TenantListSend` a partir de cidade. Não escrever `TenantLead.lastStatus` quando só houver match de lista.

### Critérios de aceite

- [ ] Status de `wamid` só-cidade: `tenantLeadId` set, `listSendId` null, `TenantLead.lastStatus` atualizado
- [ ] Status de `wamid` só-lista: `listSendId` set, `tenantLeadId` null, unlock `failed` intacto
- [ ] Status sem match: row criada, nenhum update de lead/send
- [ ] `deleted` / status desconhecido continua skip sem insert

### Não fazer

- Não persistir inbound nesta task
- Não tratar notify de cidade (sem `messageId` no notify)
- Não alterar `ListCampaignsService` / lock além do unlock já existente de lista

---

## 3.2 — Testes handleStatus

### O que fazer

Estender `webhook-persistence.service.spec.ts`. Helper `build()` deve mockar os writes de status.

Casos mínimos:

1. Cidade: `tenantLead` encontrado, `tenantListSend` null → create com `tenantLeadId`, `tenantLead.update` com `lastStatus`, **sem** `tenantListLead.update`.
2. Lista: `tenantListSend` encontrado, `tenantLead` null → create com `listSendId`, update send, `failed` unlock (se testar failed).
3. `failed` cidade **não** chama unlock de lista.
4. Unknown status: sem create.

Payload de status mínimo: `{ id, status, timestamp, recipient_id }` (conversation/pricing podem ser stub se o código não ler).

### Critérios de aceite

- [ ] `npx jest apps/notifly/src/webhook-persistence.service.spec.ts` passa
- [ ] Pelo menos um teste prova isolamento cidade vs unlock de lista

### Não fazer

- Não exigir Meta real
- Não quebrar os testes de inbound existentes

---

## Verificação do grupo

- Jest do spec acima
- Leitura de `handleStatus`: create sempre (quando enum conhecido) **antes** de qualquer return de “não achei send”

## Handoff para próxima task

Envelope preenchido. Task 4 lista `lastStatus` / `latestError`. Task 5 confirma no Postman com webhook sintético se quiserem.
