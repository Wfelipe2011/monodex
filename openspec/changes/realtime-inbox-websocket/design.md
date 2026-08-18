## Context

- Inbox de listas: `WhatsappConversationMessage` com `tenantId`, `listLeadId`; REST em `ListConversationsController` (`GET/POST .../messages`) com polling `since` — spec original dizia “sem WebSocket”.
- Inbound: Meta webhook → `notifly` → `WebhookPersistenceService.handleInboundMessage()` → Postgres.
- Auth existente: JWT (`JWT_SECRET`) com `tenantId` e `roles`; `AuthGuard` já lê `handshake.auth.token` para WebSocket.
- Front: PWA Next.js na Vercel — **não** hospeda WebSocket; conecta no gym-ctrl.
- PRD: **1 instância** de gym-ctrl e notifly — registry in-memory suficiente, sem Redis.
- Usuários: cada `User` tem `tenantId`; `SUPER_ADMIN` vive no tenant Platform mas deve ouvir **todos** os tenants via room `super-admin`.

## Goals / Non-Goals

**Goals:**

- Latência baixa: front recebe `message.inbound` segundos após persistência webhook.
- Fan-out filtrado: usuários do tenant afetado + todos `SUPER_ADMIN` online.
- Apenas inbound de lead de lista (`listLeadId` definido, `direction=IN`).
- Autenticação JWT na conexão; desconexão limpa rooms.
- Endpoint interno autenticado por secret (notifly → gym-ctrl).
- Polling REST inalterado como fallback.

**Non-Goals:**

- Web Push / VAPID / Service Worker nesta change.
- Eventos outbound, delivery statuses, mídia download.
- Inbound de outreach cidade (`tenant_lead` sem `listLeadId`).
- Socket.io (usar `ws` nativo via `@nestjs/platform-ws`).
- Horizontal scaling / sticky sessions.
- Implementação do cliente Next.js neste repo.

## Decisions

### D1 — WebSocket server no gym-ctrl (não no Next/Vercel)

**Escolha:** `@nestjs/platform-ws` + adapter `WsAdapter` em `apps/gym-ctrl/src/main.ts`.

**Por quê:** Vercel serverless não mantém conexões persistentes; gym-ctrl já é o host das APIs admin e JWT.

**Alternativa rejeitada:** SSE no gym-ctrl — suficiente para one-way, mas conversa pode evoluir; WS já acordado no explore.

### D2 — Path e transporte

**Escolha:** namespace/path `ws/inbox` (configurável via env `WS_INBOX_PATH`, default `ws/inbox`).

**Auth:** query `?token=<jwt>` **ou** primeiro frame JSON `{ "type": "auth", "token": "..." }` — preferir query para compatibilidade browser simples.

**Protocolo:** mensagens JSON text frame; servidor → cliente: eventos; cliente → servidor: opcional `ping` (MVP pode omitir).

### D3 — Rooms e autorização na conexão

Na conexão autenticada:

| Claim JWT | Rooms |
|-----------|-------|
| qualquer usuário autenticado | `tenant:{tenantId}` |
| `roles` inclui `SUPER_ADMIN` | também `super-admin` |

Fan-out no inbound do tenant `T`:

1. `tenant:T`
2. `super-admin`

Dedup: mesma conexão não entra duas vezes no mesmo room.

**Futuro:** quando REST inbox abrir para `ADMIN` de tenant, rooms já funcionam.

### D4 — Contrato do evento `message.inbound`

Emitido **apenas** quando notifly confirma persistência nova (`persisted: true`) e payload inclui `listLeadId`.

```json
{
  "type": "message.inbound",
  "tenantId": 4,
  "listId": 12,
  "leadId": 99,
  "message": {
    "id": 42,
    "wamid": "wamid.xxx",
    "direction": "IN",
    "type": "text",
    "body": "Olá",
    "phone": "5511999999999",
    "createdAt": "2026-08-17T21:00:00.000Z"
  }
}
```

`listId` resolvido via `TenantListLead.listId` no notifly antes de chamar gym-ctrl.

### D5 — Wiring notifly → gym-ctrl

**Escolha:** `POST {GYM_CTRL_BASE_URL}/internal/inbox/realtime/notify` com header `X-Internal-Secret: {INTERNAL_WS_NOTIFY_SECRET}`.

Body: DTO igual ao evento acima (sem wrapper).

**Por quê:** apps separados; HTTP simples; fire-and-forget (log error, não falhar webhook Meta se notify falhar).

**Alternativa rejeitada:** Redis pub/sub — overkill para 1 instância.

### D6 — Registry in-memory

**Escolha:** `InboxRealtimeService` com `Map<string, Set<WebSocket>>` keyed por room name.

**Por quê:** PRD single instance.

**Limitação documentada:** multi-instância exigiria Redis adapter (non-goal).

### D7 — CORS e origem

Manter `enableCors` HTTP existente. WebSocket: validar `Origin` opcionalmente via env `WS_ALLOWED_ORIGINS` (lista separada por vírgula); em dev `*` aceitável.

### D8 — Dependências npm

Adicionar ao root `package.json`:

- `@nestjs/websockets`
- `@nestjs/platform-ws`
- `ws`
- `@types/ws` (dev)

`@nestjs/websockets` já aparece como peer no lockfile.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Notify falha → front não atualiza | Log + alerta; front usa poll `since` na reconexão |
| Secret interno vazado | Header obrigatório; rotas `/internal/*` sem exposição pública desnecessária |
| Conexão cai silenciosamente | Front: reconnect com backoff; sync via GET `since` |
| Inbound sem `listLeadId` (cidade) | Não emite evento (escopo inbox lista) |
| Muitas abas abertas | Cada aba = 1 socket; aceitável para operadores |
| Proxy/load balancer sem upgrade WS | Documentar necessidade de `Upgrade: websocket` no deploy gym-ctrl |

## Migration Plan

1. Deploy gym-ctrl com WS + endpoint interno + novas env vars.
2. Deploy notifly com client notify + mesmas env vars (`INTERNAL_WS_NOTIFY_SECRET`, `GYM_CTRL_BASE_URL`).
3. Front passa a conectar WS após login (opcional nesta change — backend pronto).
4. Rollback: desabilitar chamada notify no notifly; front continua polling.

## Open Questions

- URL pública exata do gym-ctrl em PRD para documentar no handoff do front (`wss://...`).
- Se no futuro tenant `ADMIN` usar inbox, confirmar se REST também será aberto na mesma change ou posterior.
