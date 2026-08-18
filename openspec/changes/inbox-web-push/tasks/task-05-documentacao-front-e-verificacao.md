# Task 5 — Documentação front e verificação

**Change:** `inbox-web-push`
**Grupo:** 5 de 5
**Pré-requisitos:** [task-03-gym-ctrl-api-de-subscriptions.md](./task-03-gym-ctrl-api-de-subscriptions.md), [task-04-gym-ctrl-hook-publish-inbound-e-leadname.md](./task-04-gym-ctrl-hook-publish-inbound-e-leadname.md)
**Desbloqueia:** nenhum

## Objetivo do grupo

Handoff completo para o PWA Next.js e checklist E2E.

## Contexto para o subagent

- Referência: `openspec/changes/realtime-inbox-websocket/FRONT-INTEGRATION.md`
- Postman: `postman/monodex.postman_collection.json`
- User decisions: title "Nova mensagem de {lead_name}", tag per lead, preview body, iOS Home Screen

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `openspec/changes/inbox-web-push/PUSH-INTEGRATION.md` | criar |
| `postman/monodex.postman_collection.json` | editar (opcional) |

---

## 5.1 — PUSH-INTEGRATION.md

### O que fazer

Criar documento com seções:

1. **Pré-requisitos:** PWA instalado (iOS Home Screen); permissão granted; VAPID public key
2. **Service Worker** (`public/sw.js` ou next-pwa): handlers `push`, `notificationclick`
3. **Subscribe flow** após login:
```javascript
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY),
});
await fetch(`${GYM_CTRL}/admin/push-subscriptions`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(sub.toJSON()),
});
```
4. **push handler:** parse JSON; check `clients.matchAll` for visible window on same lead URL; `showNotification(title, { body, tag, data, icon })`
5. **notificationclick:** `clients.openWindow(data.url)`
6. **Tag behavior:** explain `inbox-lead-{id}` replaces prior notification (WhatsApp-style)
7. **Coordenação com WS:** when WS connected, backend skips push; SW also suppresses if focused
8. **Env vars** table (front + gym-ctrl)
9. **Unsubscribe:** DELETE on logout optional

Link to FRONT-INTEGRATION.md for WS.

### Critérios de aceite

- [ ] Front dev can implement without reading Nest code
- [ ] iOS Home Screen requirement documented

### Não fazer

- Implement Next.js code in monorepo

---

## 5.2 — Postman e checklist

### O que fazer

Postman folder **Inbox Web Push**:
- PUT push-subscriptions (example body from Push API)
- Reference internal notify (existing) with `leadName`

Checklist in PUSH-INTEGRATION.md:
1. [ ] Migration applied
2. [ ] gym-ctrl env VAPID_* set
3. [ ] Login → PUT subscription
4. [ ] WS disconnected / app closed simulation
5. [ ] Internal notify or webhook → push received
6. [ ] Title shows lead name; body shows preview
7. [ ] Second message same lead replaces notification (same tag)
8. [ ] User with WS open does not get push
9. [ ] `npm run gym:build && npm run notifly:build`

### Critérios de aceite

- [ ] Checklist complete
- [ ] Builds pass

---

## Verificação do grupo

```bash
npm run gym:build && npm run notifly:build
```

## Handoff

Change ready for `/opsx-manager-apply` or archive after implementation.
