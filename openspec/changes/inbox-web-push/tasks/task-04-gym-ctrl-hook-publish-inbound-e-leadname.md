# Task 4 — gym-ctrl + notifly — Hook publishInbound e leadName

**Change:** `inbox-web-push`
**Grupo:** 4 de 5
**Pré-requisitos:** [task-02-gym-ctrl-web-push-service-e-env.md](./task-02-gym-ctrl-web-push-service-e-env.md)
**Desbloqueia:** [task-05-documentacao-front-e-verificacao.md](./task-05-documentacao-front-e-verificacao.md)

## Objetivo do grupo

Integrar push no fluxo existente; rastrear userId no WS; incluir leadName no pipeline notifly→gym-ctrl.

## Contexto para o subagent

- Gateway: `apps/gym-ctrl/src/modules/inbox-realtime/inbox-realtime.gateway.ts` — JWT payload has `userId` / `id`
- Service: `inbox-realtime.service.ts` — `registerClient(clientId, socket, rooms)` today
- Controller internal: `internal-inbox-realtime.controller.ts` → `publishInbound`
- notifly: `notifly.controller.ts` lines ~75-94 fetches listLead with `select: { listId: true }`

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `inbox-realtime.service.ts` | userId tracking + publishInbound hook |
| `inbox-realtime.gateway.ts` | pass userId |
| `dto/inbox-inbound-event.dto.ts` | add leadName |
| `inbox-inbound-event.interface.ts` | add leadName |
| `internal-inbox-realtime.controller.ts` | inject WebPushService if needed |
| `notifly.controller.ts` | leadName in notify |
| `inbox-realtime-notify.service.ts` | type update |

---

## 4.1 — userId no WebSocket registry

### O que fazer

Extend `RoomClient` / registry:

```typescript
private readonly onlineUserIds = new Set<number>();

registerClient(clientId: string, socket: WebSocket, rooms: string[], userId: number): void {
  // existing room logic...
  this.trackUserSocket(userId, clientId);
}

unregisterClient(clientId: string): void {
  // untrack userId when last socket for user gone
}

hasOpenConnection(userId: number): boolean {
  return this.onlineUserIds.has(userId);
}

getOnlineUserIds(): Set<number> {
  return new Set(this.onlineUserIds);
}
```

Gateway connect:
```typescript
const userId = payload.userId ?? payload.id;
this.inboxRealtimeService.registerClient(clientId, client, rooms, userId);
```

### Critérios de aceite

- [ ] User with OPEN socket appears in online set
- [ ] Disconnect removes user when no sockets left

### Não fazer

- Break existing WS tests/behavior

---

## 4.2 — publishInbound + leadName end-to-end

### O que fazer

1. Add to DTO/interface:
```typescript
@IsString()
leadName: string;
```

2. `publishInbound(dto)`:
```typescript
this.broadcastToRooms(...); // existing
void this.inboxWebPushService.sendForInbound(dto, this.getOnlineUserIds());
```

3. notifly — extend query:
```typescript
select: { listId: true, name: true }
// ...
leadName: listLead.name,
```

4. Update `InboxInboundEventPayload` in notifly with `leadName: string`

### Critérios de aceite

- [ ] Internal notify with leadName validates
- [ ] publishInbound triggers push async without blocking 204
- [ ] WS fan-out unchanged
- [ ] notifly build OK

### Não fazer

- Second HTTP call from notifly for push

---

## Verificação do grupo

```bash
npm run gym:build
npm run notifly:build
# curl internal notify with leadName; user offline → push sent (manual with web-push test)
```

## Handoff

Full backend path: inbound → WS + push. Task 5 documents front SW.
