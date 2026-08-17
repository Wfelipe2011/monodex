# Task 6 — Notifly — cron de campanhas e reply actions

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 6 de 8
**Pré-requisitos:** [task-02](./task-02-shared-recipient-bindings-e-helpers.md), [task-04](./task-04-admin-campanhas.md), [task-05](./task-05-notifly-webhook-messages-e-statuses.md)
**Desbloqueia:** [task-08](./task-08-seed-postman-e-verificacao.md)

## Objetivo do grupo

Executor cron de campanhas de lista e handler NOTIFY/NOOP no webhook — sem alterar `contactLeads`.

## Contexto para o subagent

- Referência cron: `apps/notifly/src/leads.service.ts` — `handleCron`, `contactLeads`, `isWithinSchedule`, coin debit pattern
- Send Graph: `buildTemplateSendBody` + `PlatformWhatsappService.resolveCredentials()`
- Resolver bindings com `{ recipient: listLead, tenant }`
- **Sem cashback** — não copiar bloco increment coin de `responseLeads`

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/list-campaigns.service.ts` | criar |
| `apps/notifly/src/list-campaign-reply.service.ts` | criar |
| `apps/notifly/src/notifly.module.ts` | editar |
| `apps/notifly/src/notifly.controller.ts` | editar (wire reply) |

---

## 6.1 — Cron ListCampaignsService

### O que fazer

`@Injectable() ListCampaignsService` com `@Cron(CronExpression.EVERY_HOUR)`:

1. Buscar campanhas `enabled=true` com list + tenant + template
2. Filtrar `isWithinSchedule(campaign.schedule, day, hour)`
3. Saldo coin tenant ≥ `list.costPerSend` (primeiro `Coin` row — paridade outreach)
4. Selecionar leads elegíveis:
   ```sql
   sendLockCampaignId IS NULL
   OR EXISTS failed status on their last send from locking campaign
   ```
   Implementação Prisma: leads where lock null OR last send lastStatus failed
5. `batch = min(sendsPerRun, floor(balance/costPerSend), eligible.length)`
6. Para cada lead:
   - Resolver bindings role `send`
   - POST Graph template
   - Transaction:
     - Create `TenantListSend` (wamid)
     - Set `listLead.sendLockCampaignId = campaign.id`
     - Create outbound `WhatsappConversationMessage`
     - Debit coin + `CoinTransaction` (description: list campaign send)
   - Sleep `sendIntervalSeconds`

Erros Graph: log; não lock lead se POST falhou antes de wamid.

### Critérios de aceite

- [ ] Não cria `TenantLead`
- [ ] Lock após 200 + wamid
- [ ] `contactLeads` inalterado

### Não fazer

- Cashback

---

## 6.2 — Reply NOTIFY / NOOP

### O que fazer

`ListCampaignReplyService.handleButtonReply(msg, listSend)` chamado de `notifly.controller` quando:
- inbound persisted
- `msg.type === 'button'`
- `context.id` matches `TenantListSend.wamid`

Fluxo:
1. Load campaign + `buttonActions`
2. Match `msg.button.text` to action (exact label)
3. `NOOP`: return
4. `NOTIFY`:
   - Require `notifyTemplateId`, APPROVED
   - Resolve bindings role `notify` with recipient context
   - POST template to tenant phone (digits 55...)
   - Persist outbound conversation message (notify wamid)
   - **No coin credit**

Text inbound (type text): não chamar este service.

Manter `LeadsService.responseLeads` para TenantLead cidade ("Tenho Interesse!") — ordem: se listSend found → list handler; else legacy.

### Critérios de aceite

- [ ] NOTIFY envia template ao tenant.phone
- [ ] NOOP não POST extra
- [ ] Text reply não notify

### Não fazer

- Generalizar outreach legado button map nesta task

---

## Verificação do grupo

Campanha enabled + schedule match manual trigger (`onModuleInit` dev hook ou ajuste hora); mock Graph se necessário; integração real em task 8.

## Handoff

Envios de campanha geram wamid + lock; webhook completa status e reply.
