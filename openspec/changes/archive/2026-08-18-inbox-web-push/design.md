## Context

- **realtime-inbox-websocket** (implementado): Meta → notifly → `POST /internal/inbox/realtime/notify` → `InboxRealtimeService.publishInbound()` → WS rooms `tenant:{id}` + `super-admin`.
- Front PWA Next.js na Vercel; chaves VAPID já existem (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` no front; private/subject no backend a configurar).
- Decisões do produto:
  1. Notificação com contexto do lead: **"Nova mensagem de {lead_name}"** + prévia da mensagem no corpo.
  2. Agrupamento estilo WhatsApp: **`tag`** estável por conversa (`inbox-lead-{leadId}`) — nova mensagem **substitui** a notificação anterior da mesma thread no SO.
  3. **SUPER_ADMIN** recebe push de todos os tenants.
  4. Operadores usam PWA instalado (incl. iOS Home Screen).
  5. **`leadName`** incluído no dispatch (join `TenantListLead.name`).

- WS gateway hoje registra `clientId` UUID sem `userId` — push skip exige estender registry.

## Goals / Non-Goals

**Goals:**

- Push entregue quando app fechado ou sem WS OPEN para aquele user.
- Mesma audiência do WS: users do `tenantId` do evento + users com role `SUPER_ADMIN`.
- Apenas inbound de lead de lista (`listLeadId` / fluxo existente).
- Título e corpo legíveis; URL deep-link para a conversa.
- API CRUD mínima de subscriptions autenticada por JWT.
- Limpeza automática de subscriptions inválidas (410).

**Non-Goals:**

- Implementar SW ou UI no monorepo.
- Push quando WS já entregou ao mesmo user (supressão backend).
- Notificações ricas (imagem, actions) no MVP.
- Background Sync / periodic sync.

## Decisions

### D1 — VAPID único global

Um par por deploy (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, public no front). Isolamento multi-tenant na **seleção de subscriptions**, não na chave.

### D2 — Subscriptions no gym-ctrl

**Escolha:** `PushSubscription` → `userId` → `User.tenantId` + `roles`.

**API:**

| Método | Rota | Body |
|--------|------|------|
| `PUT` | `/admin/push-subscriptions` | `{ endpoint, keys: { p256dh, auth } }` |
| `DELETE` | `/admin/push-subscriptions` | `{ endpoint }` |

Auth: JWT existente (`AuthGuard`). Upsert por `endpoint` (unique). `@RolesAuth` — MVP: qualquer user autenticado (mesma base do WS); inbox REST continua SUPER_ADMIN-only no front.

### D3 — Disparo acoplado a `publishInbound`

**Escolha:** `InboxRealtimeService.publishInbound()`:

1. WS fan-out (existente)
2. `InboxWebPushService.sendForInbound(dto)` (novo, async fire-and-forget)

notifly **não** ganha segundo HTTP call.

### D4 — Payload interno estendido

Adicionar `leadName: string` em `InboxInboundEventDto` (required quando push path). notifly estende `select: { listId: true, name: true }`.

### D5 — Formato da notificação (Web Push payload JSON)

```json
{
  "title": "Nova mensagem de João Silva",
  "body": "Olá, tenho interesse!",
  "tag": "inbox-lead-99",
  "data": {
    "url": "/admin/tenants/4/lead-lists/12/leads/99",
    "tenantId": 4,
    "listId": 12,
    "leadId": 99,
    "messageId": 42
  }
}
```

**Título:** `Nova mensagem de ${leadName}` (fallback phone se name vazio).

**Corpo (`body`):** prévia normalizada:
- `type=text` → `message.body` truncado (~120 chars)
- `type=button` → texto do botão ou body
- outros → `"📎 Nova mensagem"` ou tipo legível

**Tag:** `inbox-lead-{leadId}` — comportamento WhatsApp-like (replace notification).

Front SW usa `showNotification(title, { body, tag, data })`.

### D6 — Audiência push

Query Prisma:

```sql
-- users to notify
WHERE tenant_id = :tenantId
   OR 'SUPER_ADMIN' = ANY(roles)
```

Para cada user → todas `PushSubscription` ativas.

Excluir user se `InboxRealtimeService.hasOpenConnection(userId)` === true.

### D7 — Rastrear userId no WebSocket

Estender `registerClient(clientId, socket, rooms, userId)` e `Map<userId, Set<clientId>>` ou contagem de sockets OPEN por userId.

Gateway passa `payload.userId` ou `payload.id` do JWT no connect.

### D8 — Biblioteca e env

- npm: `web-push`
- gym-ctrl Joi: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (required)
- `webpush.setVapidDetails(subject, publicKey, privateKey)` — public key derivável da private ou env `VAPID_PUBLIC_KEY` opcional para clareza

### D9 — Falhas

- Erro push: log por subscription; não falha notify HTTP 204.
- Status **410 Gone**: delete subscription.
- Outros 4xx: log + optional delete após N falhas (MVP: 410 only).

### D10 — Supressão dupla (backend + SW)

- **Backend:** skip push se WS OPEN para user.
- **Front (doc):** SW `clients.matchAll()` — se janela visível na URL da lead, skip `showNotification`.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| iOS só push com PWA instalado | Documentar; operadores confirmaram Home Screen |
| SUPER_ADMIN volume alto | tag por lead; operador pode silenciar no SO |
| WS registry sem userId (hoje) | Task explícita de extensão gateway |
| Payload > 4KB | Título + preview curto only |
| leadName desatualizado | Snapshot no momento do inbound |

## Migration Plan

1. Migration Prisma + deploy gym-ctrl com env VAPID.
2. Deploy notifly com `leadName` no notify (backward compatible se optional first).
3. Front: SW + subscribe + PUT subscription.
4. Rollback: push falha silenciosamente; WS inalterado.

## Open Questions

- Nenhuma bloqueante — decisões de produto confirmadas pelo stakeholder.
