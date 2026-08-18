# Integração front — Inbox Web Push (VAPID)

Handoff para o PWA Next.js (Vercel). O front **não** vive neste repo; use este documento como contrato único — não é necessário ler o código Nest.

Complementa o WebSocket documentado em [FRONT-INTEGRATION.md](../realtime-inbox-websocket/FRONT-INTEGRATION.md): enquanto o WS entrega `message.inbound` com o app aberto e conectado, o **Web Push** avisa quando o operador está offline (app fechado, aba em background profundo ou WS desconectado).

---

## Visão geral

| Canal | Quando usar |
|-------|-------------|
| **WebSocket** | App aberto — atualização instantânea da UI (ver [FRONT-INTEGRATION.md](../realtime-inbox-websocket/FRONT-INTEGRATION.md)) |
| **Web Push** | App fechado ou sem WS OPEN — notificação do sistema operacional |
| **REST polling** | Fallback e gap-fill (mesmo doc WS) |

Fluxo inbound: Meta webhook → **notifly** (persiste) → POST interno → **gym-ctrl** (`publishInbound`) → fan-out WS **+** envio push VAPID para subscriptions elegíveis.

---

## Pré-requisitos

1. **PWA instalado** — especialmente **iOS Safari**: Web Push só funciona com o app adicionado à **Tela de Início** (Home Screen). Safari em aba normal **não** recebe push.
2. **Permissão `Notification.permission === 'granted'`** — solicitar após login (ou após ação explícita do usuário).
3. **Chave pública VAPID** no front: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (base64url, mesmo par do backend).
4. **Service Worker registrado** e ativo (`navigator.serviceWorker.ready`).
5. **HTTPS** em produção (localhost isento para dev).

---

## Variáveis de ambiente

### Front (Next.js / Vercel)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_GYM_CTRL_API_URL` | sim | Base HTTP do gym-ctrl, ex.: `https://api.seudominio.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | sim | Chave pública VAPID (base64url) — par global único por deploy |
| `NEXT_PUBLIC_GYM_CTRL_WS_URL` | opcional | Base WS; ver [FRONT-INTEGRATION.md](../realtime-inbox-websocket/FRONT-INTEGRATION.md) |

### Backend gym-ctrl (referência ops — **não** expor ao browser)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VAPID_PRIVATE_KEY` | sim | Chave privada VAPID (base64url) |
| `VAPID_SUBJECT` | sim | `mailto:ops@seudominio.com` ou URL `https://...` |
| `VAPID_PUBLIC_KEY` | opcional | Se omitida, derivada da privada no boot |
| `INTERNAL_WS_NOTIFY_SECRET` | sim | Compartilhada com notifly (WS + notify interno) |
| `JWT_SECRET` | sim | Login e WS |

Gerar par VAPID (dev):

```bash
npx web-push generate-vapid-keys
```

---

## Service Worker

Coloque em `public/sw.js` ou configure via **next-pwa** / `@serwist/next`. O SW **deve** escutar `push` e `notificationclick`.

### Helper — VAPID key (browser)

```javascript
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
```

### Handler `push`

O backend envia JSON no payload da push (via biblioteca `web-push`):

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

| Campo | Notas |
|-------|-------|
| `title` | `Nova mensagem de {leadName}` — fallback telefone formatado se nome vazio |
| `body` | Prévia: texto truncado (~120 chars), botão, ou `📎 Nova mensagem` para mídia |
| `tag` | `inbox-lead-{leadId}` — ver seção **Tag (estilo WhatsApp)** |
| `data.url` | Deep-link relativo à conversa no admin |

Exemplo de handler com **supressão no SW** (janela já focada na mesma lead):

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const leadUrl = payload.data?.url;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const focusedOnSameLead = clients.some(
        (client) =>
          client.visibilityState === 'visible' &&
          leadUrl &&
          client.url.includes(leadUrl),
      );

      if (focusedOnSameLead) {
        return; // UI já visível — não duplicar notificação
      }

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        data: payload.data,
        icon: '/icons/icon-192.png', // ajustar ao PWA
        badge: '/icons/badge-72.png',
      });
    })(),
  );
});
```

### Handler `notificationclick`

Abrir (ou focar) a conversa ao tocar na notificação:

```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;

  const absoluteUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }
    })(),
  );
});
```

---

## Subscribe flow (após login)

Executar quando o usuário estiver autenticado e a permissão de notificação for `granted`. Re-registrar após atualização do SW (`skipWaiting` + reload) se o endpoint mudar.

```javascript
const GYM_CTRL = process.env.NEXT_PUBLIC_GYM_CTRL_API_URL;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

async function registerPushSubscription(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push não suportado neste browser');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await fetch(`${GYM_CTRL}/admin/push-subscriptions`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sub.toJSON()),
  });
}
```

Body enviado (`PushSubscription.toJSON()`):

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

Resposta: **204 No Content**. Upsert por `endpoint` (unique) — mesmo device atualiza keys/user.

---

## Unsubscribe (opcional no logout)

```javascript
async function unregisterPushSubscription(token, subscription) {
  if (!subscription) return;

  await fetch(`${GYM_CTRL}/admin/push-subscriptions`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}
```

Resposta: **204** ou **404** se endpoint não pertence ao usuário.

---

## Tag — comportamento estilo WhatsApp

O backend define `tag: "inbox-lead-{leadId}"` (ex.: `inbox-lead-99`).

No SO (Android, iOS PWA, desktop), **`showNotification` com o mesmo `tag` substitui** a notificação anterior daquela conversa — igual ao WhatsApp: uma bolha por thread, sempre com a mensagem mais recente.

Segunda mensagem do mesmo lead → mesma tag → usuário vê **uma** notificação atualizada (título + corpo novos), não uma pilha de N alertas.

---

## Coordenação com WebSocket

Duas camadas evitam notificação redundante:

### 1. Backend (gym-ctrl)

Quando `publishInbound` roda:

1. Fan-out WS para rooms `tenant:{tenantId}` e `super-admin`
2. Push VAPID **somente** para users **sem** conexão WS OPEN (`hasOpenConnection(userId) === false`)

Se o operador está com WS conectado (mesmo em background tab), **não recebe push**.

Audiência push = mesma do WS: users do `tenantId` do evento **+** todos com role `SUPER_ADMIN`.

### 2. Service Worker (front)

Mesmo que o backend envie push (race, múltiplas abas, etc.), o handler `push` deve checar `clients.matchAll()`: se existe janela **visível** na URL da lead (`data.url`), **não** chamar `showNotification`.

### Recomendação front

| Estado do app | Comportamento esperado |
|---------------|------------------------|
| WS conectado, conversa aberta | UI via WS; sem push |
| WS conectado, outra tela | WS atualiza inbox; push suprimido pelo backend |
| WS desconectado / app fechado | Push entregue pelo SO |
| iOS Home Screen, app “morto” | Push entregue (único cenário iOS) |

Manter lógica WS de [FRONT-INTEGRATION.md](../realtime-inbox-websocket/FRONT-INTEGRATION.md) (reconexão, gap-fill, polling).

---

## API REST (subscriptions)

Autenticação: `Authorization: Bearer <JWT>` (mesmo token do login / WS).

| Método | Rota | Body | Resposta |
|--------|------|------|----------|
| `PUT` | `/admin/push-subscriptions` | `{ endpoint, keys: { p256dh, auth } }` | 204 |
| `DELETE` | `/admin/push-subscriptions` | `{ endpoint }` | 204 / 404 |

---

## Endpoint interno (ops / teste — não chamar do browser)

Dispara WS **e** push (para users offline). Documentado em [FRONT-INTEGRATION.md](../realtime-inbox-websocket/FRONT-INTEGRATION.md).

```http
POST /internal/inbox/realtime/notify
Content-Type: application/json
X-Internal-Secret: <INTERNAL_WS_NOTIFY_SECRET>

{
  "type": "message.inbound",
  "tenantId": 4,
  "listId": 12,
  "leadId": 99,
  "leadName": "João Silva",
  "message": {
    "id": 42,
    "wamid": "wamid.test",
    "direction": "IN",
    "type": "text",
    "body": "Olá, tenho interesse!",
    "phone": "5511999999999",
    "createdAt": "2026-08-17T21:00:00.000Z"
  }
}
```

`leadName` alimenta o título da push. Resposta: **204 No Content**.

Postman: pasta **Inbox Web Push** e **Inbox Realtime → Internal Notify**.

---

## iOS — Tela de Início (obrigatório)

Safari no iOS **só entrega Web Push** se:

1. iOS 16.4+ (ou superior)
2. Usuário **Adicionar à Tela de Início** (Share → Add to Home Screen)
3. App aberto pelo ícone na Home Screen (standalone)
4. Permissão de notificação concedida **dentro** do PWA instalado

Safari em aba normal: `PushManager` pode existir, mas push **não** chega de forma confiável. Documentar para operadores: **instalar o PWA antes de ativar notificações**.

---

## Checklist manual E2E

Execute localmente antes de integrar o front em produção.

### Pré-requisitos

- [ ] Migration `PushSubscription` aplicada (`npx prisma migrate deploy`)
- [ ] gym-ctrl env `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e opcionalmente `VAPID_PUBLIC_KEY`) configuradas
- [ ] Front `.env` com `NEXT_PUBLIC_VAPID_PUBLIC_KEY` correspondente ao par VAPID
- [ ] Seed admin: `npm run seed:platform-admin`

### Passos

1. [ ] **Builds:** `npm run gym:build && npm run notifly:build` — ambos sem erro
2. [ ] **Subir serviços:** `npm run gym:dev` + `npm run notifly:dev`
3. [ ] **Login:** `POST /auth/login` → JWT (Postman: **Auth → Login**)
4. [ ] **Registrar subscription:** `PUT /admin/push-subscriptions` com body de exemplo (Postman: **Inbox Web Push → PUT Push Subscription**)
5. [ ] **Simular offline:** fechar todas as abas do PWA / não conectar WS (`wscat` desconectado)
6. [ ] **Disparar inbound:** Postman **Inbox Realtime → Internal Notify** com `leadName` preenchido (ou webhook notifly)
7. [ ] **Push recebida:** título `Nova mensagem de {leadName}`; corpo com prévia do texto
8. [ ] **Mesma lead, segunda mensagem:** tag `inbox-lead-{leadId}` — notificação **substituída**, não empilhada
9. [ ] **WS online:** conectar `wscat -c "ws://localhost:3000/ws/inbox?token=<JWT>"` → repetir notify → user **não** recebe push (só evento WS)
10. [ ] **Clique na notificação:** abre `/admin/tenants/.../leads/...` (handler `notificationclick`)

### Builds (CI / handoff)

```bash
npm run gym:build && npm run notifly:build
```

---

## Referências no repo

- WebSocket (complementar): [FRONT-INTEGRATION.md](../realtime-inbox-websocket/FRONT-INTEGRATION.md)
- Design: [design.md](./design.md)
- Spec push: [specs/inbox-web-push/spec.md](./specs/inbox-web-push/spec.md)
- Postman: `postman/monodex.postman_collection.json` → pastas **Inbox Web Push** e **Inbox Realtime**
