# Integração front — Inbox Realtime (WebSocket)

Handoff para o PWA Next.js (Vercel). O front **não** vive neste repo; use este documento como contrato único — não é necessário ler o código Nest.

> **Fora de escopo desta change:** Web Push / VAPID / Service Worker. Notificações push serão uma change futura separada. O realtime aqui é **somente WebSocket**; polling REST continua como fallback.

---

## Visão geral

| Canal | Uso |
|-------|-----|
| **WebSocket** | Eventos `message.inbound` em tempo real após persistência do webhook |
| **REST polling** | Fallback e gap-fill após reconexão |

Fluxo: Meta webhook → **notifly** (persiste) → POST interno → **gym-ctrl** (fan-out WS) → front.

---

## Autenticação

1. Login existente no gym-ctrl:

```http
POST /auth/login
Content-Type: application/json

{ "email": "...", "password": "..." }
```

Resposta: `{ "token": "<JWT>" }`.

2. O JWT contém `tenantId` e `roles`. Use o mesmo token na conexão WS.

---

## Conexão WebSocket

### URL

```
wss://<GYM_CTRL_HOST>/<WS_INBOX_PATH>?token=<JWT>
```

| Ambiente | Exemplo |
|----------|---------|
| Dev local | `ws://localhost:3000/ws/inbox?token=<JWT>` |
| Produção | `wss://api.seudominio.com/ws/inbox?token=<JWT>` |

- `<WS_INBOX_PATH>` default: `ws/inbox` (configurável no backend via env `WS_INBOX_PATH`).
- Token **obrigatório** na query string (`?token=`). Conexão sem token ou JWT inválido → close `4401 Unauthorized`.

### Confirmação de conexão (servidor → cliente)

Imediatamente após autenticar, o servidor envia:

```json
{
  "type": "connected",
  "rooms": ["tenant:4", "super-admin"]
}
```

- Usuário comum: room `tenant:{tenantId}` do JWT.
- `SUPER_ADMIN`: também entra em `super-admin` (ouve todos os tenants).

### Quem recebe cada evento

Fan-out de `message.inbound`:

| Room | Quem está inscrito |
|------|-------------------|
| `tenant:{tenantId}` | Usuários autenticados daquele tenant |
| `super-admin` | Todos os `SUPER_ADMIN` online |

Um cliente `SUPER_ADMIN` do tenant Platform recebe eventos de **qualquer** tenant.

---

## Evento servidor → cliente

Emitido **apenas** para inbound de lead de lista (`listLeadId` definido), após persistência no notifly.

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

| Campo | Tipo | Notas |
|-------|------|-------|
| `type` | `"message.inbound"` | Constante |
| `tenantId` | number | Tenant da lista |
| `listId` | number | ID da lead list |
| `leadId` | number | ID do lead na lista (`TenantListLead.id`) |
| `message.id` | number | PK `WhatsappConversationMessage` |
| `message.wamid` | string | ID Meta |
| `message.direction` | `"IN"` | Sempre inbound |
| `message.type` | string | ex.: `text`, `button` |
| `message.body` | string? | Texto quando aplicável |
| `message.phone` | string | E.164 |
| `message.createdAt` | string | ISO 8601 |

**Não emitido:** outbound, status de entrega, inbound sem `listLeadId`, mídia.

---

## Polling REST (fallback)

Endpoint existente — **inalterado**:

```http
GET /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages?since=<ISO8601>
Authorization: Bearer <JWT>
```

- `since` opcional: retorna mensagens com `createdAt` **estritamente posterior** ao timestamp.
- Ordenação: `createdAt ASC`.
- Use na carga inicial da conversa e após reconexão WS.

---

## Reconexão (recomendação front)

1. **Backoff exponencial** ao perder conexão: `1s → 2s → 5s → …` até **máx. 30s** entre tentativas.
2. Ao reconectar com sucesso, fazer **gap fill**:
   - Manter `lastMessageCreatedAt` da conversa aberta (maior `message.createdAt` já exibido).
   - `GET .../messages?since=<lastMessageCreatedAt>`.
   - Mesclar resultados com eventos WS recebidos durante a queda (dedup por `message.id` ou `wamid`).
3. Polling periódico em background (ex.: a cada 30–60s) continua válido como rede de segurança.

---

## Variáveis de ambiente

### Front (Next.js / Vercel)

| Variável sugerida | Obrigatória | Descrição |
|-------------------|-------------|-----------|
| `NEXT_PUBLIC_GYM_CTRL_API_URL` | sim | Base HTTP do gym-ctrl, ex.: `https://api.seudominio.com` |
| `NEXT_PUBLIC_GYM_CTRL_WS_URL` | opcional | Base WS; se omitida, derivar de `API_URL` (`http→ws`, `https→wss`) |

O path `/ws/inbox` é fixo no default do backend; só muda se ops alterar `WS_INBOX_PATH`.

### Backend (referência ops — não configurar no front)

| Serviço | Variável | Default / notas |
|---------|----------|-----------------|
| **gym-ctrl** | `INTERNAL_WS_NOTIFY_SECRET` | Obrigatória; compartilhada com notifly |
| **gym-ctrl** | `WS_INBOX_PATH` | `ws/inbox` |
| **gym-ctrl** | `JWT_SECRET` | Assina/valida JWT do login e WS |
| **gym-ctrl** | `GYM_PORT` | `3000` |
| **notifly** | `GYM_CTRL_BASE_URL` | URL HTTP do gym-ctrl, ex.: `http://localhost:3000` |
| **notifly** | `INTERNAL_WS_NOTIFY_SECRET` | Mesmo valor do gym-ctrl |
| **notifly** | `NOTIFLY_PORT` | `3100` |

`INTERNAL_WS_NOTIFY_SECRET` e `GYM_CTRL_BASE_URL` **nunca** expor ao browser.

---

## Exemplo mínimo (browser / Node)

```javascript
const token = '<JWT do login>';
const ws = new WebSocket(`ws://localhost:3000/ws/inbox?token=${encodeURIComponent(token)}`);

ws.onmessage = (event) => {
  const payload = JSON.parse(event.data);
  if (payload.type === 'connected') {
    console.log('Rooms:', payload.rooms);
  }
  if (payload.type === 'message.inbound') {
    console.log('Novo inbound:', payload);
    // Atualizar UI; guardar payload.message.createdAt para gap fill
  }
};

ws.onclose = (event) => {
  console.log('WS closed', event.code, event.reason);
  // Iniciar backoff e reconectar
};
```

Com **wscat** (dev):

```bash
npm install -g wscat
wscat -c "ws://localhost:3000/ws/inbox?token=<JWT>"
```

---

## Endpoint interno (somente ops / teste manual)

Não chamar do front. Documentado para verificação E2E e Postman.

```http
POST /internal/inbox/realtime/notify
Content-Type: application/json
X-Internal-Secret: <INTERNAL_WS_NOTIFY_SECRET>

{
  "type": "message.inbound",
  "tenantId": 4,
  "listId": 1,
  "leadId": 99,
  "message": {
    "id": 1,
    "wamid": "wamid.test",
    "direction": "IN",
    "type": "text",
    "body": "oi",
    "phone": "5511999999999",
    "createdAt": "2026-08-17T21:00:00.000Z"
  }
}
```

Resposta: **204 No Content**. Clientes WS nas rooms corretas recebem o JSON do evento.

---

## Checklist manual E2E

Execute localmente para validar a change antes de integrar o front.

### Pré-requisitos

- [ ] `.env` com `INTERNAL_WS_NOTIFY_SECRET`, `JWT_SECRET`, `DATABASE_URL` (e demais vars existentes).
- [ ] notifly: `GYM_CTRL_BASE_URL=http://localhost:3000`, `INTERNAL_WS_NOTIFY_SECRET` igual ao gym-ctrl.
- [ ] Seed admin: `npm run seed:platform-admin` (default `platform-admin@local.dev` / `platform-admin-dev`).

### Passos

1. [ ] **Subir serviços:** `npm run gym:dev` + `npm run notifly:dev` (portas 3000 e 3100 por default).
2. [ ] **Login SUPER_ADMIN:** `POST /auth/login` → obter JWT (Postman: **Auth → Login**).
3. [ ] **Conectar WS:** `wscat -c "ws://localhost:3000/ws/inbox?token=<JWT>"` → receber `{"type":"connected","rooms":[...]}`.
4. [ ] **Notify interno (curl):**

```bash
curl -X POST http://localhost:3000/internal/inbox/realtime/notify \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: <INTERNAL_WS_NOTIFY_SECRET>" \
  -d '{
    "type": "message.inbound",
    "tenantId": 1,
    "listId": 1,
    "leadId": 1,
    "message": {
      "id": 1,
      "wamid": "wamid.test",
      "direction": "IN",
      "type": "text",
      "body": "oi",
      "phone": "5511999999999",
      "createdAt": "2026-08-17T21:00:00.000Z"
    }
  }'
```

   → Cliente WS recebe evento `message.inbound` (Postman: pasta **Inbox Realtime → Internal Notify**).

5. [ ] **Webhook inbound simulado:** Postman **Notifly → Webhook Incoming (POST) — Sim** com `context.id` = `wamid` de um `TenantListSend` existente → mensagem persistida + evento WS (ajustar `tenantId`/`listId`/`leadId` conforme seed).
6. [ ] **Resiliência:** parar gym-ctrl, repetir webhook → notifly ainda responde **200**; log de erro ao tentar notify (fire-and-forget).
7. [ ] **Polling:** `GET /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages?since=<ISO8601>` com Bearer JWT → histórico incremental funciona.

### Builds

```bash
npm run gym:build && npm run notifly:build
```

Ambos devem completar sem erro.

---

## Referências no repo

- Design: [design.md](./design.md)
- Spec WS: [specs/inbox-realtime-websocket/spec.md](./specs/inbox-realtime-websocket/spec.md)
- Postman: `postman/monodex.postman_collection.json` → pasta **Inbox Realtime**
