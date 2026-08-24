# Integração front — API keys e envio on-demand

Handoff para o PWA/Next e Super Admin. Use **este arquivo + Swagger** (`swagger-spec.json` ou `GET /api` no gym-ctrl).

**Integrador só com `X-API-KEY`:** ver [API-KEY-INTEGRATION.md](./API-KEY-INTEGRATION.md) (allowlist, send, status, conversas, mídia, agenda — sem painel).

| | |
|--|--|
| **Change** | `tenant-api-keys-on-demand-send` |
| **Breaking** | **Sim (aditivo).** CORS precisa permitir header `X-API-KEY`. GET tenant/outreach passa a expor `costPerOnDemandSend`. GET tenant passa a expor `apiAccessEnabled`. |
| **Auth** | JWT (`Authorization: Bearer`) **ou** `X-API-KEY` (nunca os dois). Login inalterado: `POST /auth/login` → `{ "token": "<JWT>" }` |
| **Postman** | Pasta **On-demand API** em `postman/monodex.postman_collection.json` |

**Não** documentar / não usar o test-send de plataforma (`POST /platform/.../whatsapp-templates/.../test`) como canal do tenant. O canal on-demand é `POST /tenant/:tenantId/whatsapp-templates/:templateId/sends`.

---

## TL;DR

1. Super Admin liga `apiAccessEnabled`, define `costPerOnDemandSend` > 0, amarra número **dedicado** e grant de template.
2. Admin do tenant cria até **3** chaves (raw **uma vez** no 201), faz upload de imagem, dispara template ou agenda.
3. Integrador autentica só com `X-API-KEY` nas rotas allowlist; fora dela (ex.: `/platform/*`) → **401**.
4. Coins debitam no **webhook** (status B / `coinDebitOnStatus`), **não** no 201 do send.
5. Inbox JWT do PWA **não muda**; via chave, GET/POST conversations seguem a allowlist (D8).

---

## Breaking (obrigatório)

| Superfície | Antes | Agora |
|------------|-------|-------|
| CORS | Headers sem `X-API-KEY` | Incluir `X-API-KEY` em `allowedHeaders` (já no gym-ctrl) |
| GET tenant / list | Sem flag de API | Campo `apiAccessEnabled` (boolean, default `false`) |
| GET outreach (platform e tenant) | Sem preço on-demand | Campo `costPerOnDemandSend` (number, default `0`) |
| Auth | Só Bearer | Bearer **ou** `X-API-KEY` (ambos → 400) |

---

## Quem faz o quê

| Ação | Super Admin | Admin PWA (JWT) | Integrador (`X-API-KEY`) |
|------|-------------|-----------------|--------------------------|
| PATCH `apiAccessEnabled` | sim | 403 no path tenant | 401 |
| PATCH `costPerOnDemandSend` | sim (platform) | 403 | 401 |
| Jobs cleanup / agenda (GET/PUT) | sim | — | 401 |
| Criar / revogar chave | **não** (só GET list) | sim | **não** (401) |
| Upload mídia | **não** (só GET) | sim | sim |
| POST send on-demand | **403** | sim | sim |
| CRUD agendas (write) | **não** (só GET) | sim | sim |
| GET/POST conversations | GET sim / POST 403 | sim | sim |
| GET `/platform/tenants` | sim | — | **401** |
| Cidade / lista / WS / coins credit | — | JWT como antes | **fora** da allowlist → 401 |

---

## Super Admin

Tags: `Platform — Tenants`, `Platform — Outreach Config`, `Platform — Job Schedules`, `Platform — Template Grants`.

| Método | Path | Body / notas |
|--------|------|--------------|
| PATCH | `/platform/tenants/:id` | `{ "apiAccessEnabled": true }` — grant de API |
| GET/PATCH | `/platform/tenants/:tenantId/outreach-config` | `{ "costPerOnDemandSend": 0.4 }` — `0` fecha o canal |
| GET/PUT | `/platform/platform-job-schedules/:jobKey` | Keys: `WHATSAPP_TEMPLATE_SYNC`, `SCRAPE`, `ORPHAN_MEDIA_CLEANUP`, `ON_DEMAND_SCHEDULE_RUN` |
| POST | `/platform/tenants/:tenantId/template-grants` | Grant do template APPROVED (já existente) |
| PATCH outreach | `whatsappAccountId` dedicado | Obrigatório para send/inbox |

Seed: tenants nascem com `apiAccessEnabled=false` e `costPerOnDemandSend=0` (canal fechado). Jobs novos já seedados.

---

## Admin PWA (JWT)

Tags: `Tenant — API Keys`, `Tenant — Media`, `Tenant — WhatsApp Templates`, `Tenant — On-Demand Sends`, `Tenant — On-Demand Schedules`, `Tenant — Conversations`, `Tenant — Outreach Config`.

### Chaves

| Método | Path | Notas |
|--------|------|-------|
| GET | `/tenant/:tenantId/api-keys` | Sem secret; `prefix`, `revokedAt`, `lastUsedAt` |
| POST | `/tenant/:tenantId/api-keys` | Body `{ "name": "crm-prod" }`. **201** inclui `key` **uma vez**. Exige `apiAccessEnabled`. Máx. 3 ativas |
| POST | `/tenant/:tenantId/api-keys/:keyId/revoke` | Idempotente |

UI: ao criar, mostrar modal com copy-once; listagem **nunca** reexibe raw.

### Mídia

| Método | Path | Notas |
|--------|------|-------|
| GET | `/tenant/:tenantId/media` | `id`, `publicId`, nome, mime, size |
| POST | `/tenant/:tenantId/media` | multipart `file`; jpeg/png/webp; máx. 5 MB |
| GET | `/public/media/:publicId` | Público; Meta precisa HTTPS (`PUBLIC_API_BASE_URL`) |

No send/agenda, `imageId` = **`publicId`** (UUID), não o id sequencial.

### Disparo on-demand

```http
POST /tenant/:tenantId/whatsapp-templates/:templateId/sends
Authorization: Bearer <tenantToken>
Content-Type: application/json

{
  "to": "11999999999",
  "variables": { "body.1": "João" },
  "imageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "leadId": 1
}
```

**201** (exemplo): `{ "id", "wamid", "to", "messageStatus", "conversationId" }` — **sem** débito de coins.

Gates (400/403/404 conforme caso): grant, template APPROVED, número dedicado, `costPerOnDemandSend` > 0, saldo disponível (reserva unificada), slots + imagem se header IMAGE.

Listagem de status B:

| Método | Path |
|--------|------|
| GET | `/tenant/:tenantId/on-demand-sends` |
| GET | `/tenant/:tenantId/on-demand-sends/:sendId` |

Shape: `lastStatus` (`sent`\|`delivered`\|`read`\|`failed`\|`null`), `latestError` se failed.

### Agenda (hora SP)

```http
POST /tenant/:tenantId/on-demand-schedules
{
  "templateId": 3,
  "to": "11999999999",
  "scheduledFor": "2026-08-22T14:00:00",
  "variables": { "body.1": "João" },
  "imageId": "…"
}
```

- `scheduledFor`: início da hora em `America/Sao_Paulo` (minuto 0). Passado → **400**.
- Cancel: `POST .../on-demand-schedules/:id/cancel` só `PENDING` (senão 409).
- Worker notifly `ON_DEMAND_SCHEDULE_RUN`: na hora H, preflight; se grant/preço/saldo falhar → `FAILED` **sem** Graph e **sem** débito.

### Inbox (JWT)

Inalterado para o PWA: listar threads, mensagens, composer com `windowOpen`. Status C = conversa com janela 24h aberta (`windowOpen`).

### Outreach GET (Admin)

Lê `costPerOnDemandSend` (somente leitura). **Não** enviar no PATCH tenant.

---

## Integrador (`X-API-KEY`)

```http
X-API-KEY: mdx_…
```

Não envie `Authorization` no mesmo request (400).

### Allowlist (D8)

| Método | Path | API key |
|--------|------|---------|
| GET | `/tenant/:id/whatsapp-templates` | sim |
| POST | `/tenant/:id/whatsapp-templates/:tid/sends` | sim |
| GET | `/tenant/:id/on-demand-sends` (+ `:sendId`) | sim |
| GET/POST | `/tenant/:id/conversations...` | sim |
| POST/GET | `/tenant/:id/media` | sim |
| GET | `/public/media/:publicId` | público (sem auth) |
| CRUD write/read | `/tenant/:id/on-demand-schedules` | sim |
| GET/POST | `/tenant/:id/api-keys` | **não** → 401 |
| Qualquer | `/platform/*` | **não** → 401 |
| Cidade / lista / coins / WS notify | — | **não** → 401 |

Grant off (`apiAccessEnabled=false`) ou chave revogada → **401** imediato em qualquer rota com a chave.

Teto: 3 chaves ativas por tenant (humano cria via JWT).

Imagem pública: `GET {PUBLIC_API_BASE_URL}/public/media/{publicId}` — Meta baixa via HTTPS.

---

## Billing e status

| Momento | Coins |
|---------|-------|
| POST send → 201 | **não** debita |
| Webhook atinge `coinDebitOnStatus` (default `delivered`) | debita `costPerOnDemandSend` (idempotente) |
| Webhook `failed` após débito | estorno (mesmo serviço de cidade/lista) |
| Agenda `FAILED` no preflight | **sem** débito |

Reserva unificada: `pendingCity*costPerLead + pendingList*costPerSend + pendingOnDemand*costPerOnDemandSend`.

Thread: send cria/atualiza conversa `OUT` `type=template` no número dedicado.

---

## Tags Swagger

| Tag | Uso |
|-----|-----|
| **Tenant — API Keys** | CRUD chaves (só Bearer) |
| **Tenant — Media** | Upload/list + Bearer ou X-API-KEY |
| **Public — Media** | GET bytes públicos |
| **Tenant — WhatsApp Templates** | List granted + POST sends |
| **Tenant — On-Demand Sends** | GET status B |
| **Tenant — On-Demand Schedules** | Agenda |
| **Tenant — Conversations** | Inbox (JWT ou chave) |
| **Platform — Tenants / Outreach Config / Job Schedules** | Super Admin |

Swagger UI: Authorize → **bearer** e/ou **X-API-KEY**.

---

## Checklist E2E (gym-ctrl + notifly locais)

Marque mock vs live conforme o ambiente tiver WABA/Graph.

| # | Passo | Esperado | Mock / Live |
|---|-------|----------|-------------|
| 1 | SA: `apiAccessEnabled=true` + `costPerOnDemandSend>0` + número dedicado + template grant | Config OK | local |
| 2 | Admin cria chave; GET list | 201 com `key`; list **sem** raw | local |
| 3 | Chave GET `/tenant/:id/whatsapp-templates` | Só granted | local |
| 4 | Chave POST send → GET send | 201; `lastStatus` null/sent; webhook delivered → coins `costPerOnDemandSend`; thread OUT template | live Graph + webhook (ou sim webhook) |
| 5 | Chave GET conversations; POST texto se `windowOpen` | 200 / 201 | local (+ inbound real se quiser janela) |
| 6 | Chave GET `/platform/tenants` | **401** | local |
| 7 | Upload + GET público | 200 bytes; órfão some no job (unitário grupo 4; E2E opcional) | local |
| 8 | Agenda hora passada; futura cancel; fire com grant revogado | 400; cancel OK; `FAILED` sem débito | local (fire: worker notifly) |
| 9 | Super Admin POST send | **403** | local |

Itens críticos rastreados: **1–6** e **8–9**. Item 7 E2E de cleanup é opcional se o unitário do grupo 4 passou.

---

## Fora de escopo desta change (não implementar no front on-demand)

- Envio de cidade / campanha de lista via `X-API-KEY`
- WebSocket / push via chave
- Test-send de plataforma como substituto do send on-demand
- Super Admin criando chave, subindo mídia, agendando ou disparando
