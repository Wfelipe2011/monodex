# Integração front — envios de outreach de cidade

Handoff para o PWA/Next (não vive neste repo). Use **este arquivo + Swagger**.

**Change:** `city-outreach-send-status`  
**Swagger:** `swagger-spec.json` na raiz do monorepo, ou `GET /api` no gym-ctrl (Authorize → Bearer). Tags: `Tenant — City Outreach Sends` e `Platform — City Outreach Sends`.  
**Breaking:** não. Additive: dois GETs novos + campos `lastStatus` / `templateName` no `TenantLead` (backend). Paths de lista, inbox e JWT **não mudaram**.

Login e JWT **não mudaram**: `POST /auth/login` → `{ "token": "<JWT>" }`. Tags `Platform — *` = `SUPER_ADMIN`. Tags `Tenant — *` = `ADMIN` no `jwt.tenantId`.

---

## O que mudou (produto)

Antes: outreach de cidade (`contactLeads`) gravava só o wamid. O operador via counts de funil (`GET .../leads/stats`), não uma lista de envios com status Meta. Campanhas de lista já tinham `GET /tenant/:tenantId/lead-lists/:listId/sends`.

Agora:

- Cada disparo de cidade com Graph 200 vira um send listável (`TenantLead` com `messageId`).
- O GET devolve wamid, `sentAt`, `lastStatus`, `templateName` (snapshot) e o lead (nome/telefone).
- Status chega por **polling** do GET. Sem WebSocket, sem push, sem subscribe para esta tela.

Notify ao `Tenant.phone` (após “Tenho Interesse!”) **não** é send de cidade. Não listar notify neste recurso.

---

## Checklist para o front

1. **Nova tela Admin — envios de cidade** (`GET /tenant/:tenantId/outreach/sends`): tabela de envios, badge de `lastStatus`, filtro “falhas”.
2. **Opcional Super Admin** (`GET /platform/tenants/:tenantId/outreach/sends`): mesma tela no prefixo platform, mesmo JSON.
3. **Polling GET.** Recarregar / intervalo curto. **Não** ligar WebSocket da inbox a esta lista.
4. **Não reutilizar** a tela nem o path de `GET /tenant/:tenantId/lead-lists/:listId/sends`. Produtos isolados.
5. Funil `GET .../leads/stats` **não** substitui esta lista (counts ≠ envios com status).
6. Tipar o GET: schema Swagger `CityOutreachSendResponseDto` (array). Shape abaixo.

---

## 1. Listar envios de cidade — Admin

Tag Swagger: **Tenant — City Outreach Sends**  
Schema: `CityOutreachSendResponseDto`

| Método | Path | Auth |
|--------|------|------|
| GET | `/tenant/:tenantId/outreach/sends` | Bearer `ADMIN` (tenant do JWT) ou `SUPER_ADMIN` |
| GET | `/tenant/:tenantId/outreach/sends?status=failed` | idem |

Até 100 rows, `sentAt` desc. Só `TenantLead` com `messageId` (wamid). Captura/Baileys sem wamid **não** aparece.

### Shape (item)

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

Failed (único caso em que `latestError` existe):

```json
{
  "id": 12,
  "wamid": "wamid.xxx",
  "sentAt": "2026-08-18T20:05:00.000Z",
  "lastStatus": "failed",
  "templateName": "hello_city",
  "lead": { "id": 90, "name": "Academia X", "phone": "11999999999" },
  "latestError": { "code": 131026, "title": "Message undeliverable" }
}
```

### Campos

| Campo | Significado na UI |
|-------|-------------------|
| `id` | Id do `TenantLead` (não é id de `TenantListSend`) |
| `wamid` | Id da mensagem outbound na Meta |
| `sentAt` | Momento do Graph 200 (`createdAt` do row) |
| `lastStatus` | `sent` / `delivered` / `read` / `failed`. **`null` = Graph aceitou, Meta ainda não callback** |
| `templateName` | Nome do template no disparo. **`null` = envio anterior a esta change** (não inventar a partir da config atual) |
| `lead` | Destinatário: `id`, `name`, `phone` |
| `latestError` | **Só** quando `lastStatus` é `failed`. Omitido nos demais. Pode ser `null` se o evento failed não tiver `errors` |

Query `status` aceita só `failed`. Outro valor é ignorado (lista completa).

404 se o tenant não existir.

---

## 2. Super Admin (opcional)

Tag Swagger: **Platform — City Outreach Sends**

| Método | Path | Auth |
|--------|------|------|
| GET | `/platform/tenants/:tenantId/outreach/sends` | Bearer `SUPER_ADMIN` |
| GET | `/platform/tenants/:tenantId/outreach/sends?status=failed` | idem |

Mesmo JSON do GET tenant. Use para suporte / auditoria; a tela operacional principal é a do Admin.

---

## 3. Isolamento vs campanhas de lista

**Não misturar.** Dois recursos, duas tabelas, duas telas.

| | Cidade (esta change) | Lista (já existia) |
|--|----------------------|--------------------|
| Path | `/tenant/:tenantId/outreach/sends` | `/tenant/:tenantId/lead-lists/:listId/sends` |
| Path platform | `/platform/tenants/:tenantId/outreach/sends` | (não há equivalente de sends de lista em platform) |
| Origem | `TenantLead` com `messageId` | `TenantListSend` |
| Tela | “Envios de cidade” | “Envios da campanha / lista” |

O GET de cidade **não** lê `TenantListSend`. O GET de lista **não** muda: `GET /tenant/:tenantId/lead-lists/:listId/sends` e `?status=failed` continuam iguais.

Não unificar as duas listagens no front.

---

## 4. O que **não** muda no front

| Superfície | Ação |
|------------|------|
| Inbox / WebSocket de lista | Paths e eventos iguais. **Não** usar WS para status de cidade. |
| Funil `GET /tenant/:tenantId/leads/stats` (e platform equivalente) | Continua counts. Não substitui `/outreach/sends`. |
| Config de outreach | PUT/PATCH iguais. |
| Notify (“Tenho Interesse!” → `Tenant.phone`) | Não é send; não aparece em `/outreach/sends`. |
| Auth | JWT, roles, prefixos `/platform` vs `/tenant`. Sem mudança de JWT. |

---

## Erros úteis para toast

| HTTP | Onde | Motivo típico |
|------|------|----------------|
| 401 | qualquer GET | token ausente / inválido |
| 403 | GET tenant | `ADMIN` em outro `tenantId` |
| 403 | GET platform | JWT não é `SUPER_ADMIN` |
| 404 | ambos | tenant inexistente |

---

## Como conferir no Swagger / Postman

1. Suba o gym-ctrl → `http://<host>:<GYM_PORT>/api`.
2. Authorize com JWT `ADMIN` → tag **Tenant — City Outreach Sends**.
3. Troque para JWT `SUPER_ADMIN` → tag **Platform — City Outreach Sends**.
4. Collection Postman (mesma): **Tenant — Outreach** (`{{tenantToken}}`) e **Platform — Outreach** (`{{platformToken}}`) — requests `List City Outreach Sends` / `List Failed City Outreach Sends`.
5. Requests de lista em **Tenant — Campaigns** (`.../lead-lists/{{listId}}/sends`) **não** devem ser usadas nesta tela.

---

## Isolamento (verificação backend — evidência desta change)

Checklist para o time / QA. Não exige conta Meta: status pode ser injetado com webhook sintético.

| # | Critério | Evidência |
|---|----------|-----------|
| 1 | `contactLeads` grava `templateName` (nome do catálogo) no `tenantLead.create`; `lastStatus` permanece null até o webhook | `apps/notifly/src/leads.service.ts` — `templateName: outreachTemplate.name` |
| 2 | `handleStatus` de cidade amarra `tenantLeadId`, atualiza `TenantLead.lastStatus` e **não** chama unlock de lista | `apps/notifly/src/webhook-persistence.service.ts` + spec `failed de cidade não chama unlock de lista` |
| 3 | `GET .../outreach/sends` lê `tenantLead` (`messageId` not null); **não** lê `tenantListSend` | `apps/gym-ctrl/src/modules/admin/outreach-sends.service.ts` + spec `tenantListSend.findMany` not called |
| 4 | `GET /tenant/:tenantId/lead-lists/:listId/sends` intacto | `ListSendsController` em `list-campaigns.controller.ts`; Postman **Tenant — Campaigns** sem alteração desta change |

Webhook sintético (dev/QA, sem Meta): `POST {{notiflyBaseUrl}}/response-leads` com envelope Cloud API — `entry[].changes[].value.statuses[]`. Cada status precisa de `id` = wamid do `TenantLead.messageId`, `status` (`sent` / `delivered` / `read` / `failed`), `timestamp` e `recipient_id`. GET seguinte de `/outreach/sends` deve refletir `lastStatus`. `failed` de cidade **não** reabre o telefone para novo outreach.
