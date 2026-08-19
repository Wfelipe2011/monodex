# Integração front — inbox de conversas do tenant

Handoff para o PWA/Next (não vive neste repo). Use **este arquivo + Swagger**.

**Change:** `tenant-conversations-inbox`  
**Swagger:** `swagger-spec.json` na raiz (gerado no boot do gym-ctrl), ou `GET /api` no gym-ctrl (Authorize → Bearer). Tags: **Tenant — Conversations** e **Tenant — Ops**.  
**Breaking:** sim. Paths de mensagens de lista, payload WS `message.inbound` e push (`tag` + `data.url`) mudaram. Login JWT, rooms WS, funil `leads/stats`, listagem `/outreach/sends` e campanhas de lista **não** mudaram.

Login e JWT **não mudaram**: `POST /auth/login` → `{ "token": "<JWT>" }`. Tags `Platform — *` = `SUPER_ADMIN`. Tags `Tenant — *` = `ADMIN` no `jwt.tenantId` (Super Admin também lê `/tenant/:tenantId/*` de conversas e home).

Tenant = cliente da plataforma. Lead = destinatário WhatsApp.

---

## Breaking (obrigatório no PWA)

| Superfície | Antes | Agora |
|------------|-------|-------|
| REST mensagens | `GET/POST /tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages` | **Removido.** Use `GET /tenant/:tenantId/conversations` e `GET/POST /tenant/:tenantId/conversations/:conversationId/messages` |
| WS `message.inbound` | `listId`, `leadId`, `leadName` | `conversationId` + `displayName`. Path WS **igual**: `ws/inbox?token=` |
| Push `tag` | `inbox-lead-{leadId}` | `inbox-conversation-{conversationId}` |
| Push `data.url` | `/tenant/{tenantId}/lead-lists/{listId}/leads/{leadId}` | `/tenant/{tenantId}/conversations/{conversationId}` |
| Push `data` | `listId`, `leadId` | `conversationId` (sem `listId`/`leadId`) |

Não ligar o WebSocket da inbox na tela de envios de cidade (`GET .../outreach/sends`). Status de cidade é **polling** do GET. A home (`sends.today` / `sends.yesterday`) também é polling — **sem WS para sends**.

---

## Gate: número dedicado

Inbox (lista de threads, histórico, composer, WS, push) só para tenant com número Cloud API **dedicado** amarrado.

1. Chamar `GET /tenant/:tenantId/ops/home`.
2. Se `outreach.hasDedicatedNumber === false` → **esconder conversas** (nav, telas, subscribe WS da inbox). Default da plataforma = sem inbox.
3. `hasDedicatedNumber` é `false` quando `TenantOutreachConfig.whatsappAccountId` é `null` (remetente default compartilhado).
4. Sem número dedicado, POST de texto responde **400** (`Tenant sem número WhatsApp dedicado`) e não chama Graph.

Não inventar inbox no número default. Super Admin amarra o número no outreach config **antes** de vender conversa.

---

## Checklist de gates (não fazer / QA)

| # | Gate | Front / QA |
|---|------|------------|
| 1 | Inbound no `phoneNumberId` **default** não cria thread | Não esperar WS/push nem row na lista de conversas |
| 2 | Inbound no **dedicado** sem lead prévio cria thread e dispara notify se persistiu | Abrir `/conversations/:id`; WS `message.inbound` + push se offline |
| 3 | Template cidade / lista / test-send dedicado aparece como `OUT` `type=template` | Histórico: `direction=OUT`, `type=template` |
| 4 | Notify ao `Tenant.phone` **não** vira thread do lead | Não appendar essa OUT na conversa do destinatário do botão |
| 5 | GET conversas Super Admin **200**; POST **403** | Composer só para `ADMIN`. Super Admin só lê |
| 6 | Home `hasDedicatedNumber` **false** quando `whatsappAccountId` null | Esconder inbox; não ligar WS |

---

## 1. REST — conversas

Tag Swagger: **Tenant — Conversations**  
Auth: Bearer `ADMIN` (tenant do JWT) ou `SUPER_ADMIN` (GET). POST só `ADMIN`.

| Método | Path | Auth | Uso |
|--------|------|------|-----|
| GET | `/tenant/:tenantId/conversations` | Admin ou Super Admin | Lista de threads |
| GET | `/tenant/:tenantId/conversations/:conversationId/messages` | Admin ou Super Admin | Histórico |
| GET | `/tenant/:tenantId/conversations/:conversationId/messages?since=<ISO8601>` | Admin ou Super Admin | Polling / gap-fill (`createdAt` **estritamente posterior**) |
| POST | `/tenant/:tenantId/conversations/:conversationId/messages` | **só Admin** | Texto livre na janela 24h |

Não há `/platform/.../conversations`. Não recriar paths de `lead-lists/.../messages`.

### GET threads — shape (item)

Ordenação: `lastMessageAt` desc. Sem `listId` / lead de cidade.

```json
{
  "id": 88,
  "phone": "5511987654321",
  "displayName": "Maria",
  "lastMessageAt": "2026-08-19T12:00:00.000Z",
  "lastInboundAt": "2026-08-19T11:50:00.000Z",
  "windowOpen": true,
  "lastMessage": {
    "id": 501,
    "direction": "IN",
    "type": "text",
    "body": "Tenho Interesse!",
    "createdAt": "2026-08-19T11:50:00.000Z"
  }
}
```

| Campo | UI |
|-------|-----|
| `id` | `conversationId` da thread `(tenantId, phone)` |
| `phone` | Telefone normalizado |
| `displayName` | Snapshot: `contacts[].profile.name` do webhook, ou o **número** no inbound frio sem nome |
| `windowOpen` | `true` se `lastInboundAt` nas últimas 24h (composer) |
| `lastMessage` | Resumo; `null` se a thread não tiver mensagens |

Inbound frio: `displayName` pode ser o próprio telefone. Não exigir cadastro de lista/cidade.

### GET mensagens — shape (item)

Ordenação: `createdAt` asc. Schema Swagger `ConversationMessageResponseDto`.

```json
{
  "id": 501,
  "wamid": "wamid.HBgMNTUxMTk4NzY1NDMyMRUCABIYFDN...",
  "direction": "IN",
  "type": "text",
  "body": "Tenho Interesse!",
  "createdAt": "2026-08-17T20:10:00.000Z"
}
```

`type`: `text` \| `button` \| `template` \| `image` \| `audio` \| `document` \| `unknown` \| …  
Template no histórico (`direction=OUT`, `type=template`): campanha de **lista**, outreach de **cidade** e **test-send** no número dedicado. Mídia: persistida como tipo + raw; download CDN fora do MVP.

`since` inválido → **400**. Tenant/conversa inexistente → **404**.

### POST texto — body

```json
{ "text": "Olá! Como posso ajudar?" }
```

`text`: string 1–4096 (trim; vazio → 400). Resposta **201** = mesma shape da mensagem (`direction=OUT`, `type=text`).

| HTTP | Motivo |
|------|--------|
| 400 | `OUTSIDE_MESSAGING_WINDOW` (sem inbound na thread nas últimas 24h) — **não** chama Graph |
| 400 | Sem número dedicado; texto vazio; `since` inválido no GET; Graph 4xx |
| 403 | Super Admin no POST; tenant inativo / fora do scope |
| 404 | Tenant ou conversa inexistente |
| 502 | Graph 5xx |

Nest `BadRequestException('OUTSIDE_MESSAGING_WINDOW')` → corpo típico `{ "statusCode": 400, "message": "OUTSIDE_MESSAGING_WINDOW", "error": "Bad Request" }`. Toast nesse código: janela Meta fechada; só template (fora desta tela) reabre.

Super Admin: GET 200, POST 403 — **sem composer**.

---

## 2. WebSocket

Path **igual** ao archive: `ws/inbox?token=<JWT>` (default `WS_INBOX_PATH`; local `ws://localhost:3001/ws/inbox?token=`). Token na query. Sem token / JWT inválido → close `4401`.

Após auth, servidor envia `{ "type": "connected", "rooms": ["tenant:4", "super-admin"] }`. Rooms **iguais**: `tenant:{tenantId}` e `super-admin` para Super Admin.

### Evento `message.inbound` (**payload novo**)

```json
{
  "type": "message.inbound",
  "tenantId": 4,
  "conversationId": 88,
  "displayName": "Maria",
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

**Não** vêm `listId`, `leadId`, `leadName`. Tipar o cliente com `conversationId` + `displayName`.

Emitido só após persistir inbound na thread do dedicado. **Não** emitido: outbound, status de entrega, inbound no default.

Polling REST (`?since=`) continua como fallback e gap-fill após reconexão. Backoff 1s → 2s → 5s … máx. 30s. Dedup por `message.id` ou `wamid`.

Notify interno (ops, não chamar do browser): `POST /internal/inbox/realtime/notify` + `X-Internal-Secret` → **204**. Body = mesmo JSON do evento (campos acima).

---

## 3. Web Push

VAPID e subscriptions **iguais**:

| Método | Path | Body | Resposta |
|--------|------|------|----------|
| PUT | `/tenant/push-subscriptions` | `{ endpoint, keys: { p256dh, auth } }` | 204 |
| DELETE | `/tenant/push-subscriptions` | `{ endpoint }` | 204 / 404 |

Path **não** é `/admin/push-subscriptions`. Front: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. iOS: PWA na Tela de Início.

### Payload **novo** (breaking)

```json
{
  "title": "Nova mensagem de Maria",
  "body": "Olá, tenho interesse!",
  "tag": "inbox-conversation-88",
  "data": {
    "url": "/tenant/4/conversations/88",
    "tenantId": 4,
    "conversationId": 88,
    "messageId": 42
  }
}
```

| Campo | Contrato |
|-------|----------|
| `title` | `Nova mensagem de {displayName}` (fallback telefone formatado se nome vazio) |
| `body` | Prévia ~120 chars (`text`/`button`) ou `📎 Nova mensagem` |
| `tag` | `inbox-conversation-{conversationId}` — o SO substitui a bolha da mesma thread |
| `data.url` | `/tenant/{tenantId}/conversations/{conversationId}` |

Push só para users **sem** WS OPEN. Audiência: users do `tenantId` + todos `SUPER_ADMIN`. No Service Worker: se janela visível na `data.url`, não `showNotification`. Clique → focar/abrir essa URL.

---

## 4. Home do tenant

Tag Swagger: **Tenant — Ops**  
**Não** existe `GET /platform/ops/home`. Super Admin lê o mesmo path tenant.

| Método | Path | Auth |
|--------|------|------|
| GET | `/tenant/:tenantId/ops/home` | Admin ou Super Admin |
| GET | `/tenant/:tenantId/leads/stats` | **inalterado** — funil cidade; a home **não** substitui |

Shape D8 (controller `TenantHomeDto`):

```json
{
  "coins": { "balance": 12.5 },
  "outreach": {
    "enabled": true,
    "hasDedicatedNumber": true,
    "cityFunnel": { "contacted": 12, "replied": 4, "quoted": 1, "closed": 0, "deleted": 2 }
  },
  "inbox": {
    "threadCount": 10,
    "openWindows": 3,
    "lastInboundAt": "2026-08-19T11:00:00.000Z"
  },
  "sends": {
    "timezone": "America/Sao_Paulo",
    "today": { "sent": 1, "delivered": 4, "read": 2, "failed": 0, "pending": 1, "total": 8 },
    "yesterday": { "sent": 0, "delivered": 2, "read": 5, "failed": 1, "pending": 0, "total": 8 }
  }
}
```

| Campo | UI |
|-------|-----|
| `outreach.hasDedicatedNumber` | Gate da inbox (ver acima). `false` se `whatsappAccountId` null |
| `outreach.cityFunnel` | Mesma regra de `GET .../leads/stats` |
| `inbox.openWindows` | Threads com inbound nas últimas 24h |
| `sends.timezone` | Sempre `America/Sao_Paulo` |
| `sends.today` / `sends.yesterday` | União lista (`TenantListSend.sentAt`) + cidade (`TenantLead` com `messageId`). `pending` = `lastStatus` null. Captura sem wamid **fora** |

**Polling da home** (intervalo curto / reload). **Não** ligar WS na home nem na tela de sends de cidade. Lista detalhada de cidade continua `GET /tenant/:tenantId/outreach/sends`.

---

## 5. O que **não** muda no front

| Superfície | Ação |
|------------|------|
| Login JWT | `POST /auth/login` → `{ token }`. Prefixos `/platform` vs `/tenant` |
| Rooms WS | `tenant:{id}` e `super-admin`. Path `ws/inbox?token=` |
| Funil `GET /tenant/:tenantId/leads/stats` (e platform equivalente) | Counts iguais. Não substitui home nem `/outreach/sends` |
| Listagem `GET /tenant/:tenantId/outreach/sends` | Inalterada. Polling. Sem WS |
| Campanhas de lista | `GET/POST .../lead-lists/:listId/campaigns` e `.../sends` iguais |
| PUT/DELETE push | `/tenant/push-subscriptions` e VAPID iguais |
| Config de outreach | PUT/PATCH iguais (amarração do número é Super Admin) |

---

## Erros úteis para toast

| HTTP | Onde | Motivo típico |
|------|------|----------------|
| 400 | POST mensagens | `OUTSIDE_MESSAGING_WINDOW` ou sem número dedicado |
| 400 | GET mensagens | `since` não ISO8601 |
| 401 | qualquer | token ausente / inválido |
| 403 | POST mensagens | Super Admin; tenant inativo |
| 403 | GET tenant | `ADMIN` em outro `tenantId` |
| 404 | conversas | tenant ou thread inexistente |
| 502 | POST mensagens | Graph 5xx |

---

## Como conferir no Swagger / Postman

1. Suba o gym-ctrl → `http://<host>:<GYM_PORT>/api`.
2. Authorize com JWT `ADMIN` → tags **Tenant — Conversations** e **Tenant — Ops**.
3. Super Admin: GET conversas/mensagens/home 200; POST mensagens 403.
4. Collection Postman: **Tenant — Conversations** (`{{tenantToken}}`, variável `{{conversationId}}`) e **Tenant — Ops → Tenant Home**.
5. **Inbox Realtime → Internal Notify**: body com `conversationId` + `displayName` (não `listId`/`leadId`).
6. Requests `.../lead-lists/.../leads/.../messages` **não existem** mais na collection.

---

## Isolamento (verificação backend)

| # | Critério | Evidência |
|---|----------|-----------|
| 1 | Paths REST novos; API de mensagens de lista removida | `conversations.controller.ts` — `@Controller('tenant/:tenantId/conversations')` |
| 2 | WS payload `conversationId` + `displayName` | `inbox-inbound-event.dto.ts` + `inbox-realtime.service.ts` `publishInbound` |
| 3 | Push tag/url novos | `inbox-web-push.service.ts` `buildPushPayload` |
| 4 | Home D8, timezone SP, sem `/platform/ops/home` | `ops.controller.ts` `GET ops/home`; `HOME_SENDS_TIMEZONE` |
| 5 | POST Super Admin 403 | `conversations.controller.ts` `sendTextMessage` |
