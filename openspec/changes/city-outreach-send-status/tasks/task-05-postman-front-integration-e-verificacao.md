# Task 5 — Postman, FRONT-INTEGRATION e verificação

**Change:** `city-outreach-send-status`
**Grupo:** 5 de 5
**Pré-requisitos:** [task-02](./task-02-notifly-snapshot-no-contactleads.md), [task-03](./task-03-notifly-webhook-de-cidade.md), [task-04](./task-04-admin-api-de-listagem.md)
**Desbloqueia:** nenhum

## Objetivo do grupo

Contrato usável pelo PWA (Postman + handoff) e prova de que cidade e lista continuam isoladas.

## Contexto para o subagent

- Collection: `postman/monodex.postman_collection.json`
- Folder Tenant Outreach (~linha 1147, auth `{{tenantToken}}`): hoje só config.
- Folder Platform Outreach (~linha 495, Super Admin): hoje só config / preço / WhatsApp account.
- Sends de **lista** já existem em Tenant — Campaigns: `.../lead-lists/{{listId}}/sends` — **não** mover nem reutilizar essas requests.
- Handoff: criar `openspec/changes/city-outreach-send-status/FRONT-INTEGRATION.md` no tom de `openspec/changes/whatsapp-tenant-phone-assignment/FRONT-INTEGRATION.md` (português, paths, JSON de exemplo, checklist). Front não vive neste repo.
- `npx prisma validate` na raiz.
- Webhook sintético: `POST` notifly `/response-leads` com `entry[].changes[].value.statuses[]` — só documentar no checklist; não exigir Meta.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `postman/monodex.postman_collection.json` | editar |
| `openspec/changes/city-outreach-send-status/FRONT-INTEGRATION.md` | criar |

---

## 5.1 — Postman

### O que fazer

Em **Tenant — Outreach** adicionar:

- `GET {{gymBaseUrl}}/tenant/{{tenantId}}/outreach/sends`
- `GET {{gymBaseUrl}}/tenant/{{tenantId}}/outreach/sends?status=failed`

Em **Platform — Outreach** adicionar:

- `GET {{gymBaseUrl}}/platform/tenants/{{tenantId}}/outreach/sends`
- `GET {{gymBaseUrl}}/platform/tenants/{{tenantId}}/outreach/sends?status=failed` (opcional se a tenant failed já cobre o query)

Descrições: “somente outreach de cidade (`TenantLead` com wamid). Não mistura `TenantListSend`.”

Não apagar as requests de lista.

### Critérios de aceite

- [ ] Quatro (ou 3+1) requests novas nos folders certos
- [ ] Auth: tenant folder usa `tenantToken`; platform usa o token Super Admin do folder
- [ ] Paths **não** contém `lead-lists`

### Não fazer

- Não criar collection nova
- Não documentar notify de cidade como send

---

## 5.2 — FRONT-INTEGRATION.md

### O que fazer

Arquivo na pasta da change, cobrindo:

- Breaking: **não**. Additive.
- Tela nova (Admin e opcional Super Admin): “envios de cidade” / falhas.
- Polling GET; sem WS.
- Shape JSON:

```json
{
  "id": 12,
  "wamid": "wamid.xxx",
  "sentAt": "2026-08-18T20:05:00.000Z",
  "lastStatus": "delivered",
  "templateName": "hello_city",
  "lead": { "id": 90, "name": "Academia X", "phone": "11999999999" }
}
```

- `lastStatus` null = Graph aceitou, Meta ainda não callback.
- `templateName` null = envio anterior a esta change.
- `latestError` só em `failed`.
- Distinguir de `GET /tenant/:tenantId/lead-lists/:listId/sends`.
- Funil `GET .../leads/stats` **não** substitui esta lista.

### Critérios de aceite

- [ ] Arquivo existe e cita os dois paths
- [ ] Deixa explícito o isolamento vs lista
- [ ] Sem instruir WebSocket

### Não fazer

- Não implementar UI
- Não pedir mudança de JWT

---

## 5.3 — Validate e isolamento

### O que fazer

1. `npx prisma validate`
2. Jest já adicionados nas tasks 3 e 4 — reexecutar se o ambiente permitir.
3. Checklist no próprio FRONT ou neste handoff da change:

   - `contactLeads` grava `templateName`
   - `handleStatus` cidade não chama unlock de lista
   - GET outreach/sends não lê `tenantListSend`
   - GET list sends intacto

### Critérios de aceite

- [ ] `npx prisma validate` ok
- [ ] Checklist de isolamento escrito (neste arquivo de task como evidência no FRONT ou num parágrafo em FRONT-INTEGRATION)

### Não fazer

- Não arquivar a change (isso é `/opsx-archive`)
- Não commitar `.env`

---

## Verificação do grupo

Collection abre no Postman; FRONT descreve a tela; schema valida.

## Handoff para próxima task

Change implementável/fechável. Próximo passo humano: `/opsx-manager-apply` já rodou os grupos 1–4; este grupo é o último.
