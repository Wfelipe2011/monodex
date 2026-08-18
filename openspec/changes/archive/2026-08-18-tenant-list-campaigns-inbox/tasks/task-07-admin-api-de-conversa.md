# Task 7 — Admin — API de conversa

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 7 de 8
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-05](./task-05-notifly-webhook-messages-e-statuses.md), [task-03](./task-03-admin-listas-e-leads.md)
**Desbloqueia:** [task-08](./task-08-seed-postman-e-verificacao.md)

## Objetivo do grupo

Super-admin lê histórico e envia texto livre via Cloud API dentro da janela 24h Meta.

## Contexto para o subagent

- Credenciais: `apps/gym-ctrl/src/modules/admin/platform-whatsapp-admin.service.ts` — `resolveCredentials()` → `messagesUrl`, token
- Graph text message body:
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": { "body": "Olá!" }
}
```
- Janela 24h: última `WhatsappConversationMessage` IN com mesmo `phone` (normalized) e `listLeadId` ≥ now-24h
- Polling: query `since` ISO optional

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/list-conversations.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/list-conversations.service.ts` | criar |
| `admin.module.ts` | editar |

---

## 7.1 — GET e POST messages

### O que fazer

**`GET /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages`**

Query: `since?: string` (ISO8601)

- Validar lead pertence à list/tenant
- Query `WhatsappConversationMessage` where `listLeadId = leadId` AND (`createdAt > since` if provided)
- Order `createdAt ASC`
- Return array: `{ id, wamid, direction, type, body, createdAt }`

**`POST .../messages`** body `{ "text": "..." }`

1. Validate text non-empty, trim, reasonable max length (4096)
2. Load list lead phone → normalize
3. Check 24h window:
   ```typescript
   const lastInbound = await prisma.whatsappConversationMessage.findFirst({
     where: { listLeadId, direction: 'IN', createdAt: { gte: subHours(new Date(), 24) } },
     orderBy: { createdAt: 'desc' },
   });
   if (!lastInbound) throw BadRequestException('OUTSIDE_MESSAGING_WINDOW');
   ```
4. POST Graph text via HttpService
5. Persist OUT message with returned wamid, raw response JSON

Errors: Graph failure → 502 BadGateway with message

### Critérios de aceite

- [ ] GET retorna mensagens ordenadas
- [ ] POST sem inbound 24h → 400
- [ ] POST sucesso cria row OUT

### Não fazer

- WebSocket
- Template send via esta API (campanhas usam cron)

---

## Verificação do grupo

Após webhook simular inbound, POST text succeeds; before inbound POST fails.

## Handoff

Front externo pode poll GET com `since` + POST composer.
