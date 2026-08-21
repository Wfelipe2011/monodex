# Task 6 — Inbox e webhook

**Change:** `whatsapp-tenant-phone-assignment`
**Grupo:** 6 de 8
**Pré-requisitos:** [task-02](./task-02-resolver-de-credenciais.md)
**Desbloqueia:** [task-08](./task-08-seed-postman-e-verificacao.md)

## Objetivo do grupo

Reply do inbox sai pelo número do tenant. Inbound sem `context` num número dedicado persiste naquele tenant; no default compartilhado não inventa tenant.

## Contexto para o subagent

- Inbox send: `apps/gym-ctrl/src/modules/admin/list-conversations.service.ts` ~linha 109 `this.platformWhatsapp.resolveCredentials()` — o método já recebe `tenantId` do path (`sendText(tenantId, listId, leadId, ...)`).
- Webhook: `apps/notifly/src/notifly.controller.ts` POST `response-leads` já passa `value.metadata` para `handleInboundMessage(msg, value.metadata)`.
- Persistência: `apps/notifly/src/webhook-persistence.service.ts`
  - `handleInboundMessage(msg, _metadata: Metadata)` — o `_` precisa sair; usar `metadata.phone_number_id`
  - `resolveCorrelation` hoje: só `msg.context?.id` → `tenantListSend.wamid` → `tenantLead.messageId` → unknown
  - Type `Metadata` em `apps/notifly/src/interfaces.ts`: `display_phone_number`, `phone_number_id`
- Spec: `context` vence; dedicado sem context → tenant da FK; default sem context → não persistir tenant arbitrário (hoje já skip se `tenantId == null`)

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/list-conversations.service.ts` | editar |
| `apps/notifly/src/webhook-persistence.service.ts` | editar |

---

## 6.1 — Reply pelo número resolvido

### O que fazer

`resolveCredentials(tenantId)` no send de texto. Janela 24h, persistência OUT, 403 Super Admin depois do bootstrap — **não** mudar.

### Critérios de aceite

- [ ] Graph POST usa `phoneNumberId` da conta dedicada quando o tenant tem FK
- [ ] Tenant sem FK usa default

### Não fazer

- Não persistir `whatsappAccountId` em `WhatsappConversationMessage`
- Não alterar GET de mensagens

---

## 6.2 — Correlação inbound com `phone_number_id`

### O que fazer

Em `resolveCorrelation(msg, metadata)`:

1. Manter o caminho `context.id` (list send, depois tenant lead) **primeiro**.
2. Se unknown e `metadata?.phone_number_id`:
   - `whatsappAccount.findFirst({ where: { phoneNumberId } })`
   - Se conta encontrada, `isDefault === false`, e `tenantOutreachConfig.findUnique({ where: { whatsappAccountId: account.id } })`:
     - return `{ kind: 'unknown' | novo kind p.ex. 'dedicated_number', tenantId: config.tenantId, listLeadId: null, listSendId: null }`
   - Default, conta inexistente, ou default compartilhada: tenantId null (skip persist como hoje)

Não usar `phone_number_id` para **sobrescrever** um tenant já resolvido via wamid.

`handleInboundMessage` deve passar metadata para `resolveCorrelation`.

### Critérios de aceite

- [ ] Inbound com `context.id` de list send continua no tenant da lista mesmo se o metadata for outro número (não deve acontecer, mas context manda)
- [ ] Sem context + `phone_number_id` dedicado amarrado → persist `tenantId` certo, `listLeadId` null
- [ ] Sem context + número default → `persisted: false`, sem tenant chutado
- [ ] Parâmetro deixa de se chamar `_metadata` ignorado

### Não fazer

- Não correlacionar status delivery por número (grupo fora)
- Não baixar mídia

---

## Verificação do grupo

Payload webhook mínimo (sem context, metadata.phone_number_id = dedicado) cria row de conversa. Mesmo payload com o phone_number_id da default não cria.

## Handoff para próxima task

Grupo 7 não depende deste. Grupo 8 pode documentar o contrato do webhook no Postman se já houver pasta de webhook; senão verificação via código/log basta.
