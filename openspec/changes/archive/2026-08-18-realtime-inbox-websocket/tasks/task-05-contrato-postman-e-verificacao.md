# Task 5 — Contrato, Postman e verificação

**Change:** `realtime-inbox-websocket`
**Grupo:** 5 de 5
**Pré-requisitos:** [task-04-notifly-disparo-apos-inbound-persistido.md](./task-04-notifly-disparo-apos-inbound-persistido.md)
**Desbloqueia:** nenhum (change completa)

## Objetivo do grupo

Documentar contrato para o front Next.js e validar fluxo manual E2E.

## Contexto para o subagent

- Front **fora** deste repo (Vercel).
- Polling REST continua: `GET /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages?since=`
- Login: endpoint existente em gym-ctrl retorna `{ token }`.
- Postman collection pode existir no repo — procurar `postman` ou similar antes de criar.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `openspec/changes/realtime-inbox-websocket/FRONT-INTEGRATION.md` | criar (handoff front) |
| Postman/collection existente | editar se houver padrão no repo |

---

## 5.1 — Documentar contrato e env vars

### O que fazer

Criar `openspec/changes/realtime-inbox-websocket/FRONT-INTEGRATION.md` com:

**Conexão**

```
wss://<GYM_CTRL_HOST>/ws/inbox?token=<JWT>
```

**Evento servidor → cliente**

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

**Reconexão**

- Backoff exponencial (1s, 2s, 5s, max 30s)
- Após reconnect: `GET messages?since=<lastMessageCreatedAt>` para gap fill

**Env backend (referência ops)**

| Serviço | Variável |
|---------|----------|
| gym-ctrl | `INTERNAL_WS_NOTIFY_SECRET`, `WS_INBOX_PATH`, `JWT_SECRET`, `GYM_PORT` |
| notifly | `GYM_CTRL_BASE_URL`, `INTERNAL_WS_NOTIFY_SECRET` |

**Quem recebe**

- Users do tenant (`tenant:{tenantId}`)
- Todos SUPER_ADMIN online (`super-admin`)

### Critérios de aceite

- [ ] Documento permite integrar front sem ler código Nest
- [ ] Menciona que VAPID/push é out of scope

### Não fazer

- Implementar código React/Next neste repo

---

## 5.2 — Checklist manual E2E

### O que fazer

Checklist em `FRONT-INTEGRATION.md` ou seção final:

1. [ ] `npm run gym:dev` + `npm run notifly:dev` com env configurado
2. [ ] Login SUPER_ADMIN → JWT
3. [ ] Conectar WS (`wscat` ou browser) → conexão ok
4. [ ] curl internal notify (task 3) → evento recebido no WS
5. [ ] POST webhook inbound simulado com `context.id` de `TenantListSend` existente → persist + WS event
6. [ ] Parar gym-ctrl, repetir webhook → Meta ainda 200, log de erro notify
7. [ ] GET messages?since= → polling ainda funciona

Se existir collection Postman, adicionar folder "Inbox Realtime" com request notify interno.

### Critérios de aceite

- [ ] Checklist executável documentado
- [ ] Builds passam: `npm run gym:build && npm run notifly:build`

### Não fazer

- Testes e2e automatizados (opcional, não obrigatório nesta change)

---

## Verificação do grupo

Revisar que todos os itens do checklist passam localmente.

## Handoff

Change pronta para archive após implementação. Front conecta WS usando doc; VAPID permanece change futura separada.
