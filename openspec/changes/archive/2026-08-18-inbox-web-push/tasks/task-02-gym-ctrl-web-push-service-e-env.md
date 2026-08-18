# Task 2 — gym-ctrl — Web Push service e env

**Change:** `inbox-web-push`
**Grupo:** 2 de 5
**Pré-requisitos:** [task-01-schema-e-migration.md](./task-01-schema-e-migration.md)
**Desbloqueia:** [task-04-gym-ctrl-hook-publish-inbound-e-leadname.md](./task-04-gym-ctrl-hook-publish-inbound-e-leadname.md)

## Objetivo do grupo

Serviço de envio VAPID com formatação WhatsApp-style e seleção de audiência.

## Contexto para o subagent

- `InboxInboundEventDto` em `apps/gym-ctrl/src/modules/inbox-realtime/dto/inbox-inbound-event.dto.ts`
- Joi em `apps/gym-ctrl/src/gym.module.ts`
- Design D5/D6/D8/D9

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `package.json` | `web-push` dependency |
| `apps/gym-ctrl/src/gym.module.ts` | Joi VAPID keys |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-web-push.service.ts` | criar |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-realtime.module.ts` | registrar provider |

---

## 2.1 — web-push e InboxWebPushService

### O que fazer

1. `npm install web-push` (+ types if needed)

2. Joi:
```typescript
VAPID_PRIVATE_KEY: Joi.string().required(),
VAPID_SUBJECT: Joi.string().required(), // mailto: or https URL
```

3. **`InboxWebPushService`** (`@Injectable()`):

OnModuleInit:
```typescript
webpush.setVapidDetails(
  config.get('VAPID_SUBJECT'),
  // public key: web-push can derive from private, or use env VAPID_PUBLIC_KEY if set
  publicKey,
  config.get('VAPID_PRIVATE_KEY'),
);
```

Method `async sendForInbound(dto: InboxInboundEventDto, skipUserIds: Set<number>): Promise<void>`:

- Build notification:
  - `title = \`Nova mensagem de ${dto.leadName?.trim() || formatPhone(dto.message.phone)}\``
  - `body = buildPreview(dto.message)` — truncate 120 chars; button uses body; image → "📎 Nova mensagem"
  - `tag = \`inbox-lead-${dto.leadId}\``
  - `data.url = \`/admin/tenants/${dto.tenantId}/lead-lists/${dto.listId}/leads/${dto.leadId}\``
  - include tenantId, listId, leadId, messageId in data

- Query users:
```typescript
const users = await prisma.user.findMany({
  where: {
    OR: [
      { tenantId: dto.tenantId },
      { roles: { has: Roles.SUPER_ADMIN } },
    ],
  },
  select: { id: true, pushSubscriptions: true },
});
```

- For each user not in `skipUserIds`, for each subscription, `webpush.sendNotification(subscription, JSON.stringify(payload))`
- Catch errors: 410 → `prisma.pushSubscription.delete({ where: { endpoint } })`; log others

Fire-and-forget from caller (don't throw to controller).

### Critérios de aceite

- [ ] Service compila com web-push
- [ ] Title/body/tag conforme design
- [ ] 410 remove subscription

### Não fazer

- Enviar push from notifly directly

---

## 2.2 — Audiência e skip WS (interface)

### O que fazer

Expose `sendForInbound(dto, onlineUserIds: Set<number>)` where onlineUserIds comes from InboxRealtimeService (task 4).

For MVP in this task, accept `Set<number>` parameter; task 4 wires it.

Unit-testable helper `buildPushPayload(dto): { title, body, tag, data }` as private or exported for clarity.

### Critérios de aceite

- [ ] Users in skip set receive no push
- [ ] SUPER_ADMIN query uses `roles: { has: SUPER_ADMIN }`

### Não fazer

- Alterar WS broadcast logic here

---

## Verificação do grupo

```bash
npm run gym:build
```

## Handoff

`InboxWebPushService.sendForInbound` pronto; task 4 integra em publishInbound.
