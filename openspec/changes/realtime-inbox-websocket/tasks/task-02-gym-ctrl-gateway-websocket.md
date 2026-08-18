# Task 2 — gym-ctrl — Gateway WebSocket

**Change:** `realtime-inbox-websocket`
**Grupo:** 2 de 5
**Pré-requisitos:** [task-01-dependencias-e-configuracao.md](./task-01-dependencias-e-configuracao.md)
**Desbloqueia:** [task-03-gym-ctrl-endpoint-interno-de-notify.md](./task-03-gym-ctrl-endpoint-interno-de-notify.md)

## Objetivo do grupo

Expor WebSocket autenticado por JWT com rooms por tenant e super-admin, registry in-memory para fan-out.

## Contexto para o subagent

- `AuthGuard` em `libs/guard/auth.guard.ts` já suporta `request.handshake.auth.token` — útil se usar Socket.io-style; com `ws` nativo, extrair token da **query string** `?token=` no gateway.
- JWT verify: reutilizar `jwt.verify(token, process.env.JWT_SECRET)` como `AuthGuard.validateToken`.
- Roles enum: `SUPER_ADMIN`, `ADMIN`, `USER` (`prisma/schema.prisma`).
- Login retorna token em `apps/gym-ctrl/src/modules/auth.service.ts`.
- Design: path default `ws/inbox`, rooms `tenant:{id}` e `super-admin`.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-realtime.module.ts` | criar |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-realtime.gateway.ts` | criar |
| `apps/gym-ctrl/src/modules/inbox-realtime/inbox-realtime.service.ts` | criar |
| `apps/gym-ctrl/src/main.ts` | editar (WsAdapter) |
| `apps/gym-ctrl/src/gym.module.ts` | editar (import module) |

---

## 2.1 — InboxRealtimeModule, Gateway e Service

### O que fazer

**`InboxRealtimeService`**

- `registerClient(clientId: string, socket: WebSocket, rooms: string[])`
- `unregisterClient(clientId: string)`
- `broadcastToRooms(rooms: string[], payload: object)` — serializa JSON, ignora sockets não OPEN
- Internamente: `Map<string, Set<{ id: string; socket: WebSocket }>>` por room **ou** Map client→rooms + iterate

**`InboxRealtimeGateway`** (`@WebSocketGateway({ path: process.env.WS_INBOX_PATH ?? 'ws/inbox' })`)

1. `handleConnection(client, request)`:
   - Parse URL query `token` de `request.url` (use `URL` com base dummy ou regex)
   - Se ausente/inválido: `client.close(4401, 'Unauthorized')`
   - Decode JWT → `UserToken`
   - `rooms = [`tenant:${tenantId}`]`
   - Se `roles.includes('SUPER_ADMIN')` → push `'super-admin'`
   - Registrar no service
   - Opcional: enviar `{ "type": "connected", "rooms": [...] }`

2. `handleDisconnect(client)` → unregister

**Exportar** `broadcast(payload: InboxInboundEventDto)` no service para task 3.

Referência Nest WS: usar `@nestjs/platform-ws` e tipos de `ws` (`WebSocket`).

### Critérios de aceite

- [ ] Conexão com JWT válido permanece aberta
- [ ] JWT inválido fecha conexão
- [ ] User tenant 4 entra só em `tenant:4`; SUPER_ADMIN também em `super-admin`

### Não fazer

- Lógica de notify HTTP neste gateway
- Emitir eventos no connect (exceto ack opcional)

---

## 2.2 — WsAdapter e registro no GymModule

### O que fazer

Em `apps/gym-ctrl/src/main.ts`:

```typescript
import { WsAdapter } from '@nestjs/platform-ws';

// após NestFactory.create:
app.useWebSocketAdapter(new WsAdapter(app));
```

Importar `InboxRealtimeModule` em `GymModule` (ou `AdminModule` se preferir agrupar admin — either ok).

Garantir CORS HTTP existente não quebra; WS upgrade é separado.

### Critérios de aceite

- [ ] `npm run gym:dev` sobe; log indica porta GYM_PORT
- [ ] Cliente WS consegue conectar em `ws://localhost:${GYM_PORT}/ws/inbox?token=...`

### Não fazer

- Alterar rotas REST existentes

---

## Verificação do grupo

Teste manual com `wscat` ou script node:

```bash
# 1. Login POST /auth/login → token
# 2. wscat -c "ws://localhost:3000/ws/inbox?token=<JWT>"
```

## Handoff para próxima task

`InboxRealtimeService.broadcastToRooms` pronto para ser chamado pelo controller interno.
