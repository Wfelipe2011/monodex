# Integração via X-API-KEY

Guia para **sistemas externos** (CRM, ERP, automação) que consomem a API do Monodex com header `X-API-KEY`.

| | |
|--|--|
| **Change** | `tenant-api-keys-on-demand-send` |
| **Base** | gym-ctrl (mesmo host do Swagger `GET /api`) |
| **Auth** | Somente `X-API-KEY: <chave>` — **não** envie `Authorization: Bearer` no mesmo request (400) |
| **Chave** | Emitida pelo Admin do tenant no painel (raw mostrado **uma vez**). Até 3 ativas. Revogada ou API desligada → **401** |

Pré-requisitos (feitos pelo operador Monodex, não pela sua integração):

1. API habilitada para o tenant (`apiAccessEnabled`)
2. Preço on-demand > 0 (`costPerOnDemandSend`)
3. Número WhatsApp **dedicado** amarrado
4. Templates liberados (grants) e status Meta `APPROVED`
5. Chave criada e entregue ao seu sistema

---

## Autenticação

```http
X-API-KEY: mdx_live_…
```

- O `tenantId` na URL **deve** ser o do dono da chave. Outro tenant → **403**.
- Chave inválida, revogada ou API desligada → **401**.
- Rotas fora da allowlist abaixo → **401** (mesmo com chave válida).

---

## Allowlist (o que a chave pode chamar)

| Método | Path | Uso |
|--------|------|-----|
| GET | `/tenant/:tenantId/whatsapp-templates` | Templates liberados ao tenant |
| POST | `/tenant/:tenantId/whatsapp-templates/:templateId/sends` | Disparo imediato |
| GET | `/tenant/:tenantId/on-demand-sends` | Lista envios (status de entrega) |
| GET | `/tenant/:tenantId/on-demand-sends/:sendId` | Detalhe de um envio |
| GET | `/tenant/:tenantId/conversations` | Threads da inbox |
| GET | `/tenant/:tenantId/conversations/:conversationId/messages` | Histórico (`?since=` opcional) |
| POST | `/tenant/:tenantId/conversations/:conversationId/messages` | Texto livre (janela 24h) |
| GET | `/tenant/:tenantId/media` | Listar imagens do tenant |
| POST | `/tenant/:tenantId/media` | Upload de imagem |
| GET | `/public/media/:publicId` | Download público (**sem** auth) |
| POST | `/tenant/:tenantId/on-demand-schedules` | Agendar envio |
| GET | `/tenant/:tenantId/on-demand-schedules` | Listar agendas |
| GET | `/tenant/:tenantId/on-demand-schedules/:scheduleId` | Detalhe |
| POST | `/tenant/:tenantId/on-demand-schedules/:scheduleId/cancel` | Cancelar se `PENDING` |

### Fora da allowlist (sempre 401 com chave)

- Qualquer `/platform/*`
- `/tenant/:tenantId/api-keys` (criar/revogar chave)
- Coins, outreach config write, cidade, listas, scrape, convites, WebSocket/push

---

## 1. Listar templates

```http
GET /tenant/{tenantId}/whatsapp-templates
X-API-KEY: mdx_…
```

Retorna só templates **granted** (id, name, language, status, slots). Use o `id` no path de send. Não dispara sync Meta.

Slots informam o que enviar em `variables` / `imageId` (ex.: `body.1`, `header.image`).

---

## 2. Upload de imagem (header IMAGE)

```http
POST /tenant/{tenantId}/media
X-API-KEY: mdx_…
Content-Type: multipart/form-data

file: <jpeg|png|webp, máx. 5 MB>
```

**201** (exemplo):

```json
{
  "id": 1,
  "publicId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "originalFileName": "banner.png",
  "mimeType": "image/png",
  "byteSize": 102400,
  "createdAt": "2026-08-21T12:00:00.000Z"
}
```

No send/agenda use **`publicId`** como `imageId` (não o `id` numérico).

Listagem:

```http
GET /tenant/{tenantId}/media
X-API-KEY: mdx_…
```

URL pública (Meta baixa no envio; sem chave):

```http
GET /public/media/{publicId}
```

---

## 3. Enviar template agora

```http
POST /tenant/{tenantId}/whatsapp-templates/{templateId}/sends
X-API-KEY: mdx_…
Content-Type: application/json

{
  "to": "11999999999",
  "variables": { "body.1": "João" },
  "imageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "leadId": 1
}
```

| Campo | Obrigatório | Notas |
|-------|-------------|--------|
| `to` | sim | Dígitos; `55` prefixado se faltar |
| `variables` | se o template tiver slots de texto | Mapa slot key → texto livre |
| `imageId` | se o template tiver HEADER IMAGE | = `publicId` da mídia do **mesmo** tenant |
| `leadId` | não | Só para preencher bindings `lead.*`; o destino continua sendo `to` |

**201** (exemplo):

```json
{
  "id": 10,
  "wamid": "wamid.HBgNNTUxMTk5OTk5OTk5OQ==",
  "to": "5511999999999",
  "messageStatus": "accepted",
  "conversationId": 88
}
```

**Importante:** o 201 **não** debita coins. Cobrança ocorre depois, no webhook de status Meta (`sent` / `delivered` / `read` conforme config do tenant; default `delivered`).

Erros comuns: template não liberado / não APPROVED, sem número dedicado, preço 0, saldo insuficiente, slot/imagem faltando → **400** (ou 404 de recurso). Sem Graph nesses casos.

Cria/atualiza thread de conversa com mensagem `OUT` `type=template`.

---

## 4. Status de entrega (status B)

```http
GET /tenant/{tenantId}/on-demand-sends
X-API-KEY: mdx_…

GET /tenant/{tenantId}/on-demand-sends/{sendId}
X-API-KEY: mdx_…
```

Campos úteis: `id`, `wamid`, `phone`, `templateId`, `lastStatus` (`sent` \| `delivered` \| `read` \| `failed` \| `null`), `sentAt`, `conversationId`, `latestError` (se failed).

Fluxo típico: guardar `id`/`wamid` do 201 → polling no GET até `delivered` / `failed` / `read`.

---

## 5. Conversas (status C / janela 24h)

```http
GET /tenant/{tenantId}/conversations
X-API-KEY: mdx_…
```

Threads com `windowOpen` (inbound nas últimas 24h), `lastInboundAt`, resumo da última mensagem.

```http
GET /tenant/{tenantId}/conversations/{conversationId}/messages
GET /tenant/{tenantId}/conversations/{conversationId}/messages?since=2026-08-21T12:00:00.000Z
X-API-KEY: mdx_…
```

Responder texto livre (só com janela aberta e número dedicado):

```http
POST /tenant/{tenantId}/conversations/{conversationId}/messages
X-API-KEY: mdx_…
Content-Type: application/json

{ "text": "Olá! Como posso ajudar?" }
```

Fora da janela 24h → **400** (`OUTSIDE_MESSAGING_WINDOW` ou equivalente). Para reabrir conversa fora da janela, use **template** (seção 3), não texto livre.

Não há WebSocket na chave: use polling com `?since=`.

---

## 6. Agendar envio (data + hora)

Uma agenda = **1** destinatário + **1** template + **1** horário (início da hora em `America/Sao_Paulo`).

```http
POST /tenant/{tenantId}/on-demand-schedules
X-API-KEY: mdx_…
Content-Type: application/json

{
  "templateId": 3,
  "to": "11999999999",
  "scheduledFor": "2026-08-22T14:00:00",
  "variables": { "body.1": "João" },
  "imageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

- `scheduledFor`: horário de Brasília, **minuto 0**. Passado → **400**.
- Snapshot de `variables` / `imageId` fica na agenda; na hora H a plataforma revalida grant, saldo, mídia, etc.

```http
GET /tenant/{tenantId}/on-demand-schedules
GET /tenant/{tenantId}/on-demand-schedules/{scheduleId}
X-API-KEY: mdx_…
```

Status: `PENDING` \| `CANCELLED` \| `SENT` \| `FAILED` (+ `failedReason` se falhou no preflight).

Cancelar só enquanto `PENDING`:

```http
POST /tenant/{tenantId}/on-demand-schedules/{scheduleId}/cancel
X-API-KEY: mdx_…
```

Já `SENT` / `FAILED` → **409**. Preflight falho na hora H → `FAILED` **sem** chamada Graph e **sem** débito de coins. Sucesso → vira envio on-demand (`SENT`); acompanhe status B em `/on-demand-sends`.

---

## Billing (o que sua integração precisa saber)

| Momento | Coins |
|---------|-------|
| POST send → 201 | não debita |
| Agenda `FAILED` no preflight | não debita |
| Webhook Meta atinge o gatilho do tenant | debita `costPerOnDemandSend` |
| Webhook `failed` depois de já debitado | estorno |

Saldo insuficiente no POST ou na hora H → **400** / agenda `FAILED`, sem envio.

---

## Erros rápidos

| Código | Significado típico |
|--------|-------------------|
| 400 | Body inválido, gates (preço, dedicado, slots, saldo), ambos auth headers, fora da janela 24h |
| 401 | Chave inválida / revogada / API off / rota fora da allowlist |
| 403 | `tenantId` da URL ≠ tenant da chave |
| 404 | Recurso inexistente no tenant |
| 409 | Agenda já não é `PENDING` (cancel) |
| 502 | Falha Graph após preflight ok |

---

## Checklist mínimo do integrador

1. Guardar a chave com segurança (nunca em repo público).
2. `GET .../whatsapp-templates` → escolher `templateId` APPROVED.
3. Se HEADER IMAGE: `POST .../media` → guardar `publicId`.
4. `POST .../sends` → guardar `id` / `wamid` / `conversationId`.
5. Poll `GET .../on-demand-sends/:id` até status final.
6. Respostas do lead: poll conversations + `?since=`; POST texto só com `windowOpen`.
7. Agendas: criar com hora SP; cancelar se ainda `PENDING`; tratar `FAILED` sem esperar webhook.

Swagger UI: Authorize → esquema **X-API-KEY** (não misturar com Bearer no mesmo request).
