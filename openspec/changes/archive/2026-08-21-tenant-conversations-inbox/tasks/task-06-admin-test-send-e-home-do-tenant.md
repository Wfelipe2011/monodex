# Task 6 — Admin — test-send e home do tenant

**Change:** `tenant-conversations-inbox`
**Grupo:** 6 de 7
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-telefone-nome-e-gate-dedicado.md)
**Desbloqueia:** [task-07](./task-07-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Test-send em número dedicado amarrado grava `OUT` na thread (sem coins / sem `TenantLead`). Home do tenant agrega coins, funil, flag de dedicado, inbox e status de envios hoje/ontem em `America/Sao_Paulo`.

## Contexto para o subagent

- Test-send: `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.ts` `testSend` — Graph ok devolve `{ wamid, to, messageStatus }`; **não** persiste conversa. Credenciais: `resolveTestSendCredentials(dto.whatsappAccountId)` (omitido = default).
- DTO: `dto/test-whatsapp-template.dto.ts` (`whatsappAccountId` opcional).
- Spec: `whatsapp-templates.service.spec.ts`.
- Amarração: `TenantOutreachConfig.whatsappAccountId` unique → achar `tenantId` da conta usada no teste. Se a conta for default ou não tiver config, não gravar thread.
- `to` já sai por `normalizeBrazilPhoneDigits`; alinhar ao `normalizeListPhone` na thread (mesmo dígitos `55…`).
- Ops: `ops.controller.ts` — `TenantLeadsStatsController` em `tenant/:tenantId` só tem `GET leads/stats`. `OpsService.leadsStats` devolve `{ contacted, replied, quoted, closed, deleted }`.
- Coins: `CoinsService.listCoins` — `balance` da home = **soma** de `Coin.balance` do tenant.
- Sends cidade: `TenantLead` com `messageId` not null; timestamp = `createdAt`; status = `lastStatus`.
- Sends lista: `TenantListSend.sentAt` + `lastStatus`; filtrar `campaign.list.tenantId`.
- Timezone: `America/Sao_Paulo`. Implementar cortes de dia sem depender de TZ do processo (usar offset fixo -03 **ou** `Intl`/`date-fns-tz` se já existir no repo; **não** adicionar dependência nova se um cálculo explícito bastar). DST Brasil abolido: -03 o ano todo.
- Guards iguais ao `leads/stats` (Admin + Super Admin, scope + tenant active).
- Sem `GET /platform/ops/home` novo.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/whatsapp-templates.service.spec.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/ops.service.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/ops.controller.ts` | editar |
| `apps/gym-ctrl/src/modules/admin/ops.service.spec.ts` | criar se não existir; senão editar |

---

## 6.1 — Test-send grava conversa no dedicado amarrado

### O que fazer

Após Graph 200 com `wamid`, se `creds.accountId` (ou o `whatsappAccountId` do DTO) corresponde a conta `isDefault=false` **e** existe `tenantOutreachConfig` com essa FK:

1. Upsert thread `(config.tenantId, phone)`.
2. `displayName`: `leadCtx.name` se `leadId` foi usado; senão phone.
3. Create mensagem `OUT` `type: 'template'` `body: template.name` `raw` do payload Graph.

Default / conta sem tenant: return atual, zero writes em conversation.

Continua: sem `TenantLead`, sem `CoinTransaction`.

### Critérios de aceite

- [ ] Teste dedicado amarrado → `whatsappConversationMessage.create` com `conversationId`
- [ ] Teste default → create de conversa **não** chamado
- [ ] Resposta HTTP do test-send permanece `{ wamid, to, messageStatus }` (não precisa incluir thread)

### Não fazer

- Não criar `TenantLead`
- Não debitar coins
- Não mudar sync de catálogo

---

## 6.2 — GET home

### O que fazer

`GET /tenant/:tenantId/ops/home` no `TenantLeadsStatsController` (ou controller tenant ops irmão). Swagger tag `Tenant — Ops`.

Shape (design D8):

```json
{
  "coins": { "balance": 12.5 },
  "outreach": {
    "enabled": true,
    "hasDedicatedNumber": true,
    "cityFunnel": { "contacted": 12, "replied": 4, "quoted": 1, "closed": 0, "deleted": 2 }
  },
  "inbox": {
    "threadCount": 10,
    "openWindows": 3,
    "lastInboundAt": "2026-08-19T11:00:00.000Z"
  },
  "sends": {
    "timezone": "America/Sao_Paulo",
    "today": { "sent": 1, "delivered": 4, "read": 2, "failed": 0, "pending": 1, "total": 8 },
    "yesterday": { "sent": 0, "delivered": 2, "read": 5, "failed": 1, "pending": 0, "total": 8 }
  }
}
```

- `hasDedicatedNumber`: config com account `isDefault=false`.
- `openWindows`: count conversations `lastInboundAt >= now-24h`.
- `sends.*`: buckets `sent|delivered|read|failed|pending` + `total`. `pending` = `lastStatus` null. Cidade sem `messageId` excluída. Não somar o mesmo wamid duas vezes (lista e cidade são tabelas distintas).

`cityFunnel` reutiliza `leadsStats` (não duplicar queries de regra).

### Critérios de aceite

- [ ] Path e guards iguais ao restante `/tenant/:tenantId`
- [ ] Super Admin GET não é 403
- [ ] `sends.timezone` é exatamente `America/Sao_Paulo`
- [ ] `leads/stats` permanece (home não substitui)

### Não fazer

- Não expor unread/`lastReadAt`
- Não misturar captura sem wamid em `sends`
- Não criar home em `/platform`

---

## 6.3 — Testes home e test-send

### O que fazer

- test-send: mock prisma `whatsappConversation.upsert` + `message.create` no caso dedicado; assert `not.toHaveBeenCalled` no default.
- home: mocks de count/aggregate — um `TenantListSend` delivered “hoje” SP + um `TenantLead` pending “hoje” → `today.delivered=1`, `today.pending=1`, `today.total=2`; row cidade `messageId` null ignorada; send “ontem” não entra em today.

Fixar relógio no teste (`jest.useFakeTimers` ou injetar `now`) para não flakar na meia-noite SP.

### Critérios de aceite

- [ ] Specs cobrem dedicado vs default no test-send
- [ ] Specs cobrem agregação today/yesterday e exclusão captura

### Não fazer

- Não bater em Graph real
- Não exigir Postgres real

---

## Verificação do grupo

Jest `whatsapp-templates.service.spec` e `ops.service.spec`.

## Handoff para próxima task

Postman: request Home no folder Tenant — Ops; test-send já existe no folder de templates (não precisa novo path).
