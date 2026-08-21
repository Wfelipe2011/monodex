# Task 5 — Admin — WebSocket e web push

**Change:** `tenant-conversations-inbox`
**Grupo:** 5 de 7
**Pré-requisitos:** [task-01](./task-01-schema-e-migration.md), [task-03](./task-03-notifly-thread-no-webhook-e-nos-templates.md) (contrato do payload interno)
**Desbloqueia:** [task-07](./task-07-postman-front-integration-e-verificacao.md)

## Objetivo do grupo

gym-ctrl aceita e espalha `message.inbound` com `conversationId` + `displayName`. Push agrupa e abre a thread, não o lead de lista.

## Contexto para o subagent

- DTO validado: `apps/gym-ctrl/src/modules/inbox-realtime/dto/inbox-inbound-event.dto.ts` — hoje `listId`, `leadId`, `leadName`.
- Interface: `inbox-inbound-event.interface.ts` (duplicar o shape; manter as duas iguais).
- Controller interno: `internal-inbox-realtime.controller.ts` → `publishInbound(dto)` (path e secret **não** mudam).
- Fan-out: `inbox-realtime.service.ts` `publishInbound` copia campos para o JSON do WS.
- Push: `inbox-web-push.service.ts` — `buildPushPayload`, `tag` `inbox-lead-{leadId}`, `data.url` `/tenant/{tenantId}/lead-lists/{listId}/leads/{leadId}`. Funções exportadas `formatPhone`, `buildPreview`, `buildPushPayload`.
- Gateway `ws/inbox` e rooms `tenant:{id}` / `super-admin` **não mudam**.
- Elegibilidade push (users do tenant + SUPER_ADMIN, skip WS OPEN) **não muda**.
- Notifly já envia o payload novo (task 3). Se os tipos divergirem, o POST interno falha validação — alinhar **exatamente** ao design:

```json
{
  "type": "message.inbound",
  "tenantId": 4,
  "conversationId": 88,
  "displayName": "Maria",
  "message": {
    "id": 1,
    "wamid": "wamid.xxx",
    "direction": "IN",
    "type": "text",
    "body": "oi",
    "phone": "5511999998888",
    "createdAt": "2026-08-19T12:00:00.000Z"
  }
}
```

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/inbox-realtime/dto/inbox-inbound-event.dto.ts` | editar |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-inbound-event.interface.ts` | editar |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-realtime.service.ts` | editar |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-web-push.service.ts` | editar |

---

## 5.1 — DTO e publishInbound

### O que fazer

- Trocar `listId`/`leadId`/`leadName` por `conversationId` (`@IsInt`) e `displayName` (`@IsString`).
- `publishInbound` reencaminha esses campos; rooms iguais.
- ValidationPipe do controller interno deve rejeitar payload antigo (sem `conversationId`).

### Critérios de aceite

- [ ] Interface e DTO class-validator sem `listId`/`leadId`
- [ ] JSON enviado no WS contém `conversationId` e `displayName`
- [ ] Path `POST /internal/inbox/realtime/notify` e header `X-Internal-Secret` inalterados

### Não fazer

- Não mudar `WS_INBOX_PATH`
- Não enviar push para outbound

---

## 5.2 — Tag e deep link da push

### O que fazer

Em `buildPushPayload`:

- `title`: `Nova mensagem de ${displayName}` (trim; fallback `formatPhone(message.phone)` se vazio).
- `tag`: `inbox-conversation-${conversationId}`.
- `data.url`: `/tenant/${tenantId}/conversations/${conversationId}`.
- `data`: `tenantId`, `conversationId`, `messageId` — **sem** `listId`/`leadId`.

Manter preview texto/botão vs 📎 e cleanup 410.

### Critérios de aceite

- [ ] `tag` usa conversationId
- [ ] `data.url` é o path REST de thread da task 4
- [ ] Skip de users com WS OPEN permanece

### Não fazer

- Não alterar VAPID / `PUT /tenant/push-subscriptions`
- Não reescrever o Service Worker (front fora do repo; documentar na task 7)

---

## Verificação do grupo

Compilação gym-ctrl; se existir spec de push, atualizar. Payload legado com `listId` deve falhar validação.

## Handoff para próxima task

FRONT-INTEGRATION (task 7) descreve o evento WS e o JSON da push. Postman da pasta Inbox Realtime, se tiver body de exemplo, precisa do shape novo.
