# Task 7 — Postman, FRONT-INTEGRATION e verificação

**Change:** `tenant-conversations-inbox`
**Grupo:** 7 de 7
**Pré-requisitos:** [task-03](./task-03-notifly-thread-no-webhook-e-nos-templates.md), [task-04](./task-04-admin-api-de-conversas.md), [task-05](./task-05-admin-websocket-e-web-push.md), [task-06](./task-06-admin-test-send-e-home-do-tenant.md)
**Desbloqueia:** nenhum (change aplicável)

## Objetivo do grupo

Contrato para o PWA: REST novo, WS/push breaking, home. Postman substitui inbox de lista. Checklist do gate dedicado.

## Contexto para o subagent

- Collection: `postman/monodex.postman_collection.json`.
- Folder atual `Tenant — Inbox` (~linha 1657) usa  
  `/tenant/{{tenantId}}/lead-lists/{{listId}}/leads/{{leadId}}/messages` (GET + POST).
- Folder `Tenant — Ops` (~1980) tem só `leads/stats`.
- Folder `Inbox Realtime` (~2137) — atualizar body de exemplo do notify interno se existir `listId`/`leadId`.
- Padrão de handoff: `openspec/changes/city-outreach-send-status/FRONT-INTEGRATION.md` (tabelas de path, shape JSON, o que **não** mudou).
- WS documentado em `openspec/changes/archive/2026-08-18-realtime-inbox-websocket/FRONT-INTEGRATION.md` — não editar o archive; o novo arquivo desta change é a fonte para o payload **novo**.
- Push archive: `openspec/changes/archive/2026-08-18-inbox-web-push/PUSH-INTEGRATION.md` — idem, copiar o que continua válido (VAPID, PUT subscriptions) e apontar URL/tag novos.
- Swagger: `swagger-spec.json` é gerado pelo gym-ctrl; não editar na mão se o fluxo do repo for generate no boot. Mencionar tags `Tenant — Conversations` e `Tenant — Ops`.
- Variáveis Postman já existem: `gymBaseUrl`, `tenantId`, JWT folders Admin vs Super Admin.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `postman/monodex.postman_collection.json` | editar |
| `openspec/changes/tenant-conversations-inbox/FRONT-INTEGRATION.md` | criar |

---

## 7.1 — Postman

### O que fazer

Folder **Tenant — Inbox** (renomear para **Tenant — Conversations** se ficar mais claro):

| Request | Método | Path |
|---------|--------|------|
| List conversations | GET | `/tenant/{{tenantId}}/conversations` |
| List messages | GET | `/tenant/{{tenantId}}/conversations/{{conversationId}}/messages` |
| List messages since | GET | mesmo + `?since=` |
| Send text (Admin) | POST | `/tenant/{{tenantId}}/conversations/{{conversationId}}/messages` body `{ "text": "..." }` |

Remover URLs `lead-lists/.../messages`. Adicionar variável `conversationId` na collection se ainda não houver.

Folder **Tenant — Ops**: `GET /tenant/{{tenantId}}/ops/home`.

Atualizar exemplos de webhook/notify interno (`listId` → `conversationId`, `leadName` → `displayName`).

### Critérios de aceite

- [ ] Zero requests para `.../lead-lists/.../leads/.../messages`
- [ ] Home presente
- [ ] POST de texto só no folder autenticado como Admin do tenant

### Não fazer

- Não adicionar `/platform/ops/home`
- Não commitar `.env`

---

## 7.2 — FRONT-INTEGRATION.md

### O que fazer

Criar `openspec/changes/tenant-conversations-inbox/FRONT-INTEGRATION.md` cobrindo:

1. **Breaking:** paths de mensagens de lista; evento WS; push `data.url` e `tag`.
2. Gate: inbox só com `hasDedicatedNumber` (home). Default = esconder conversas.
3. REST: listar threads, mensagens + `since`, POST texto, 400 `OUTSIDE_MESSAGING_WINDOW`, Super Admin sem composer.
4. WS: path `ws/inbox?token=` **igual**; JSON com `conversationId` + `displayName`.
5. Push: `tag` `inbox-conversation-{id}`; URL `/tenant/{tenantId}/conversations/{conversationId}`. VAPID/subscriptions iguais.
6. Home: shape D8; `sends.today` / `yesterday`; timezone SP; polling da home (sem WS para sends).
7. Template no histórico: `type=template` (lista, cidade, test-send dedicado).
8. Inbound frio: `displayName` pode ser o número.
9. O que **não** mudou: login JWT, rooms, funil `leads/stats`, listagem `/outreach/sends`, campanhas de lista.

Tom direto, sem analogia de “academia” / ginásio. Tenant = cliente da plataforma; lead = destinatário WhatsApp.

### Critérios de aceite

- [ ] Arquivo existe e lista paths + shapes
- [ ] Breaking WS/push explícito
- [ ] Diz para não ligar WS na tela de sends de cidade

### Não fazer

- Não implementar telas
- Não editar specs arquivadas como se fossem o contrato vigente

---

## 7.3 — Validate e checklist

### O que fazer

```
npx prisma validate
```

Checklist no próprio FRONT ou no final da task (marcar mentalmente / no PR, não precisa de arquivo extra):

- [ ] Inbound no `phoneNumberId` default não cria thread
- [ ] Inbound no dedicado sem lead prévio cria thread e dispara notify se persistiu
- [ ] Template cidade/lista/test-send dedicado aparece como `OUT` `template`
- [ ] Notify `Tenant.phone` não vira thread do lead
- [ ] GET conversas Super Admin 200; POST 403
- [ ] Home `hasDedicatedNumber` false quando `whatsappAccountId` null

### Critérios de aceite

- [ ] `npx prisma validate` ok
- [ ] Checklist acima refletido no FRONT-INTEGRATION (seção “não fazer / gates”)

### Não fazer

- Não arquivar a change (`/opsx-archive`)
- Não implementar código de produto nesta task além de Postman/docs

---

## Verificação do grupo

Collection abre no Postman sem paths mortos; FRONT-INTEGRATION cobre REST + WS + push + home.

## Handoff para próxima task

Change implementável. Próximo passo humano: `/opsx-manager-apply`.
