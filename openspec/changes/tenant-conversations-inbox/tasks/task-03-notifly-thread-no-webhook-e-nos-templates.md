# Task 3 — Notifly — thread no webhook e nos templates

**Change:** `tenant-conversations-inbox`
**Grupo:** 3 de 7
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-telefone-nome-e-gate-dedicado.md)
**Desbloqueia:** [task-05](./task-05-admin-websocket-e-web-push.md), [task-07](./task-07-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

Inbound no número dedicado vira thread + `IN` + notify WS. Templates ao **lead** (lista e cidade) viram `OUT` na thread. Notify ao `Tenant.phone` não entra na thread do lead.

## Contexto para o subagent

- Persistência: `apps/notifly/src/webhook-persistence.service.ts` (`handleInboundMessage`, `resolveCorrelation`).
- Spec atual: `apps/notifly/src/webhook-persistence.service.spec.ts` — já cobre `list_send`, `tenant_lead`, `dedicated_number`, skip default.
- Controller: `apps/notifly/src/notifly.controller.ts` — `POST response-leads` passa só `msg` + `metadata`; notify exige `listLeadId`. Passar `value.contacts`.
- Payload notify: `apps/notifly/src/inbox-realtime-notify.service.ts` (`InboxInboundEventPayload` com `listId`/`leadId`/`leadName`).
- Lista OUT: `apps/notifly/src/list-campaigns.service.ts` (~250) já `whatsappConversationMessage.create` com `listLeadId`. Incluir `conversationId` após upsert.
- Cidade OUT: `apps/notifly/src/leads.service.ts` `contactLeads` cria `TenantLead` com `messageId` **sem** mensagem de conversa.
- Notify lista ao tenant: `apps/notifly/src/list-campaign-reply.service.ts` `handleNotify` envia para `normalizeListPhone(tenant.phone)` — **não** upsertar thread do lead.
- Credenciais: `apps/notifly/src/platform-whatsapp.service.ts` (espelho do admin `resolveCredentials(tenantId)`). Conferir se devolve `isDefault` / `accountId`; se não, ler a conta após resolver.
- Gate: upsert só se `isDedicatedPlatformAccount` e `TenantOutreachConfig.whatsappAccountId` daquele tenant = essa conta.
- Funil cidade `leadsService.responseLeads` (botão interesse) **permanece**; não misturar com thread.
- P2002 em `wamid` continua ignorado (duplicata inbound).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/notifly/src/webhook-persistence.service.ts` | editar |
| `apps/notifly/src/webhook-persistence.service.spec.ts` | editar |
| `apps/notifly/src/notifly.controller.ts` | editar |
| `apps/notifly/src/inbox-realtime-notify.service.ts` | editar |
| `apps/notifly/src/list-campaigns.service.ts` | editar |
| `apps/notifly/src/leads.service.ts` | editar |
| `apps/notifly/src/list-campaign-reply.service.ts` | editar só se hoje grava mensagem no phone do lead; **não** gravar no `Tenant.phone` |

---

## 3.1 — Inbound upsert thread

### O que fazer

Estender `handleInboundMessage(msg, metadata, contacts?)`:

1. Correlacionar como hoje (`list_send` → `tenant_lead` → `dedicated_number`).
2. **Novo filtro:** mesmo com tenant resolvido, só persistir conversa se `metadata.phone_number_id` for conta `isDefault=false` **amarrada** a esse tenant. Context de lista/cidade no **default** → não criar thread (pode seguir funil/botão como hoje, sem `WhatsappConversationMessage` nova se a regra do design for estrita). Implementar o gate no persist da mensagem de conversa.
3. `phone = normalizeListPhone(msg.from)`.
4. `profileName = matchContactProfileName(contacts, msg.from)`.
5. Upsert `whatsappConversation` `(tenantId, phone)`; `resolveConversationDisplayName`.
6. Create mensagem com `conversationId`; atualizar `lastMessageAt` / `lastInboundAt`.
7. Retorno: incluir `conversationId` e `displayName`; `listLeadId` pode continuar para botões de campanha.

Manter `handleStatus` intocado nesta task.

### Critérios de aceite

- [ ] Dedicado amarrado + frio (sem context) → `persisted` true, `conversationId` number, `listLeadId` null
- [ ] Default sem assignment → não cria `WhatsappConversation`
- [ ] `contacts[].profile.name` vira `displayName`
- [ ] Sem nome, `displayName` = phone normalizado

### Não fazer

- Não emitir template ao `Tenant.phone`
- Não mudar `handleStatus` / `lastStatus`
- Não exigir `listLeadId` para persistir

---

## 3.2 — Outbound template na thread

### O que fazer

Após Graph 200 com `wamid`, se o tenant tem número dedicado:

- **Lista** (`list-campaigns.service.ts` transação que já cria mensagem): upsert thread do phone do **lead**; setar `conversationId`; `type: 'template'`, `body: template.name`.
- **Cidade** (`contactLeads`): além de `tenantLead.create`, upsert thread do phone do lead + mensagem `OUT` template. Não gravar se FROM for default.
- **Notify `Tenant.phone`** (`list-campaign-reply` e notify cidade em `leads.service.responseLeads`): não criar/atualizar thread do lead. Se o reply service hoje faz `whatsappConversationMessage.create` com `phone: tenant.phone`, **parar** de criar essa row **ou** não ligá-la a uma thread de lead (preferência do design: não upsert conversation para esse destino).

`displayName` no create da thread por outbound: nome do list lead / `Lead.name` se conhecido; senão phone.

### Critérios de aceite

- [ ] Campanha de lista em tenant dedicado grava `OUT` com `conversationId`
- [ ] `contactLeads` dedicado grava `OUT` na thread do lead
- [ ] `contactLeads` no default não cria `WhatsappConversation`
- [ ] Envio para `Tenant.phone` não aparece na thread do lead

### Não fazer

- Não debitar coins extra
- Não criar `TenantLead` no test-send (isso é task 6)
- Não alterar seleção de leads do cron

---

## 3.3 — Notify interno

### O que fazer

Em `notifly.controller.ts`, após persistir inbound:

- Disparar `notifyInbound` se `result.persisted && result.conversationId != null` (não `listLeadId`).
- Payload:

```ts
{
  type: 'message.inbound',
  tenantId,
  conversationId,
  displayName,
  message: { id, wamid, direction: 'IN', type, body?, phone, createdAt: ISO }
}
```

Atualizar `InboxInboundEventPayload` em `inbox-realtime-notify.service.ts`: remover `listId`, `leadId`, `leadName`.

Manter: falha do notify não quebra HTTP 200 do webhook; botões lista + `Tenho Interesse!` como hoje.

### Critérios de aceite

- [ ] Frio dedicado notifica
- [ ] Default skip não chama gym-ctrl
- [ ] Tipo TypeScript do payload sem `listId`/`leadId`

### Não fazer

- Não mudar path `GYM_CTRL_BASE_URL` / `INTERNAL_WS_NOTIFY_SECRET`
- Não alterar rooms WS (isso é gym-ctrl)

---

## 3.4 — Testes de persistência e skip de notify

### O que fazer

Estender `webhook-persistence.service.spec.ts`:

- Dedicado frio + contacts nome.
- Dedicado frio sem contacts → displayName = phone.
- Default → `persisted: false` para conversa.
- Context `list_send` no dedicado → thread + `listLeadId` preenchido.
- Context `tenant_lead` no dedicado → thread, `listLeadId` null.

Opcional: spec do controller com mock de `inboxRealtimeNotify` (notify chamado só com `conversationId`).

### Critérios de aceite

- [ ] Casos acima no spec de persistência
- [ ] Testes existentes de `handleStatus` continuam verdes

### Não fazer

- Não mockar Graph
- Não testar gym-ctrl aqui

---

## Verificação do grupo

Jest dos specs notifly tocados.

## Handoff para próxima task

Contrato interno `message.inbound` com `conversationId` + `displayName`. gym-ctrl (task 5) deve aceitar esse JSON. API REST de conversas é task 4 (independente).
