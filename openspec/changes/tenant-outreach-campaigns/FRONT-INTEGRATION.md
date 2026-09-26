# Integração front — Campanhas de prospecção (pool)

Handoff para o PWA/Next (não vive neste repo). Use **este arquivo + Swagger**.

**Change:** `tenant-outreach-campaigns`  
**Swagger:** `swagger-spec.json` na raiz, ou `GET /api` no gym-ctrl (Authorize → Bearer). Tags principais: **Tenant — Outreach Campaigns**, **Tenant — Outreach** (config master), **Tenant — City Outreach Sends**, **Tenant — Conversations**, **Tenant — Ops**.  
**Breaking:** sim — `GET/PATCH/PUT .../outreach-config` **não** expõe mais `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `outreachTemplateId`, `notifyTemplateId`, `slotBindings`. Esses campos migraram para campanhas pool.

Login e JWT **não mudaram**: `POST /auth/login` → `{ "token": "<JWT>" }`. Tags `Platform — *` = `SUPER_ADMIN`. Tags `Tenant — *` = `ADMIN` no `jwt.tenantId` (Super Admin também lê a maioria das rotas tenant).

**Campanhas de lista** (`/tenant/:tenantId/lead-lists/:listId/campaigns`) **não mudaram** nesta change. **Campanhas de prospecção** = pool global por cidade (`TenantOutreachCampaign`).

---

## Breaking — config master vs campanhas

| Antes (config) | Agora |
|----------------|-------|
| Um bloco único: master + schedule + templates + categorias | **Config master** (`TenantOutreachConfig`): preço, cashback, coin debit, WhatsApp, master `enabled` |
| PATCH tenant com knobs de envio | **Campanhas** (`TenantOutreachCampaign`): `name`, `enabled`, schedule, categories, templates, bindings, `cityId`, knobs de run |

### GET `/tenant/:tenantId/outreach-config` (shape)

Somente master + pricing + conta resolvida. Opcional `campaignCount`.

```json
{
  "id": 5,
  "tenantId": 8,
  "enabled": true,
  "costPerLead": 0.35,
  "costPerOnDemandSend": 0,
  "cashbackOnReply": 0,
  "coinDebitOnStatus": "delivered",
  "whatsappAccountId": null,
  "createdAt": "2026-08-17T12:00:00.000Z",
  "updatedAt": "2026-09-24T17:00:00.000Z",
  "resolvedWhatsappAccount": {
    "id": 1,
    "phoneNumberId": "123456789012345",
    "displayPhone": "+55 12 98888-7777",
    "isDefault": true
  },
  "campaignCount": 2
}
```

### PUT `/tenant/:tenantId/outreach-config` (criação tenant)

Body mínimo — **sem** preço (403 se enviar `costPerLead`):

```json
{ "enabled": false }
```

### PATCH `/tenant/:tenantId/outreach-config` (Admin)

Apenas master switch:

```json
{ "enabled": true }
```

Preço, `coinDebitOnStatus`, `whatsappAccountId`, `cashbackOnReply` → **Platform** (`/platform/tenants/:tenantId/outreach-config`).

### Master switch

`outreach-config.enabled === false` → **nenhuma** campanha pool dispara, mesmo com `campaign.enabled === true`.  
`outreach-config.enabled === true` → cada campanha com `enabled` e schedule compatível pode rodar no cron.

---

## Nova superfície — CRUD campanhas de prospecção

Tag Swagger: **Tenant — Outreach Campaigns**  
Base: `/tenant/:tenantId/outreach-campaigns`  
Auth: Bearer `ADMIN` (tenant do JWT) ou `SUPER_ADMIN`.

| Método | Path | Uso |
|--------|------|-----|
| GET | `/tenant/:tenantId/outreach-campaigns` | Lista (com refs mínimas de template) |
| POST | `/tenant/:tenantId/outreach-campaigns` | Criar |
| GET | `/tenant/:tenantId/outreach-campaigns/:campaignId` | Detalhe |
| PATCH | `/tenant/:tenantId/outreach-campaigns/:campaignId` | Atualização parcial |
| DELETE | `/tenant/:tenantId/outreach-campaigns/:campaignId` | Hard delete |

### POST — exemplo

```json
{
  "name": "Premium SP",
  "enabled": false,
  "outreachTemplateId": 10,
  "notifyTemplateId": 11,
  "slotBindings": {
    "outreach": {
      "body.1": { "type": "literal", "value": "Acme Ltda" },
      "header.image": { "type": "header_image", "value": "https://..." }
    },
    "notify": {
      "body.customer_name": { "type": "lead.name" },
      "body.customer_phone": { "type": "lead.phone" }
    }
  },
  "schedule": { "2": [18], "4": [13, 18] },
  "categories": ["Construtoras", "Consultórios"],
  "leadsPerRun": 5,
  "sendIntervalSeconds": 5,
  "cityId": null
}
```

`enabled: true` exige templates **APPROVED**, grants do tenant e bindings completos (mesmas regras de antes, agora por campanha).

### GET item — exemplo

```json
{
  "id": 3,
  "tenantId": 8,
  "name": "Padrão",
  "enabled": true,
  "schedule": { "2": [18], "4": [13] },
  "categories": ["contadores"],
  "leadsPerRun": 5,
  "sendIntervalSeconds": 5,
  "outreachTemplateId": 10,
  "notifyTemplateId": 11,
  "slotBindings": { "outreach": {}, "notify": {} },
  "cityId": null,
  "createdAt": "2026-08-17T12:00:00.000Z",
  "updatedAt": "2026-09-24T17:00:00.000Z",
  "outreachTemplate": {
    "id": 10,
    "name": "test_gladson",
    "language": "pt_BR",
    "status": "APPROVED"
  },
  "notifyTemplate": {
    "id": 11,
    "name": "lembrete_entrar_contato_interessado",
    "language": "pt_BR",
    "status": "APPROVED"
  }
}
```

### Catálogo de categorias (inalterado no path)

`GET /tenant/:tenantId/outreach-config/eligible-categories` — use para multiselect de `categories` ao criar/editar **campanha**, não mais no PATCH de config.

Tenants migrados recebem campanha **Padrão** com os valores antigos do config (migration SQL).

---

## Navegação sugerida (Admin)

1. **Configuração da conta** — master `enabled`, preço/coins/WhatsApp (leitura Admin; escrita preço só Super Admin). Sem editor de schedule/templates aqui.
2. **Campanhas de prospecção** — lista + CRUD de campanhas pool (schedule, categorias, templates, bindings, `cityId` opcional, enable por campanha).

Mantenha **Campanhas de lista** em fluxo separado (`lead-lists/.../campaigns`).

---

## Inbox — filtros e `prospecting`

Tag: **Tenant — Conversations**  
`GET /tenant/:tenantId/conversations`

| Query | Descrição |
|-------|-----------|
| `q` | Busca em `displayName` ou substring do telefone (case-insensitive) |
| `outreachCampaignId` | Threads cujo último envio pool foi desta campanha |
| `templateName` | Filtra pelo `templateName` do último envio pool na thread |

Cada thread pode incluir `prospecting` (derivado do último `TenantLead` com wamid para o telefone normalizado):

```json
{
  "id": 88,
  "phone": "5511987654321",
  "displayName": "Maria",
  "lastMessageAt": "2026-08-19T12:00:00.000Z",
  "lastInboundAt": "2026-08-19T11:50:00.000Z",
  "windowOpen": true,
  "lastMessage": { "id": 501, "direction": "IN", "type": "text", "body": "Oi", "createdAt": "..." },
  "prospecting": {
    "outreachCampaignId": 3,
    "outreachCampaignName": "Padrão",
    "lastOutreachTemplateName": "test_gladson"
  }
}
```

`prospecting` pode ser `null` se não houver envio pool com wamid para aquele telefone.

WebSocket, push e gate de número dedicado **não mudaram** (ver change `tenant-conversations-inbox`).

---

## Envios de cidade + home

### GET envios

| Path | Queries |
|------|---------|
| `GET /tenant/:tenantId/outreach/sends` | `status=failed` (opcional), `outreachCampaignId` (opcional) |
| `GET /platform/tenants/:tenantId/outreach/sends` | idem (Super Admin) |

Item inclui campanha quando conhecida:

```json
{
  "id": 12,
  "wamid": "wamid.xxx",
  "sentAt": "2026-08-18T20:05:00.000Z",
  "lastStatus": "delivered",
  "templateName": "test_gladson",
  "outreachCampaignId": 3,
  "outreachCampaignName": "Padrão",
  "lead": { "id": 90, "name": "Academia X", "phone": "11999999999" }
}
```

Envios legados (pré-migration) podem ter `outreachCampaignId` / `outreachCampaignName` null.

### GET home ops

`GET /tenant/:tenantId/ops/home` — em `sends`:

- `today` / `yesterday`: buckets agregados (como antes)
- **`byOutreachCampaign`**: array `{ outreachCampaignId, name, today, yesterday }` por campanha pool

Use para cards ou breakdown na home; polling GET (sem WebSocket para sends).

---

## Comportamento de produto (não confundir na UI)

1. **Várias campanhas, mesmo horário** — o cron processa campanhas enabled do tenant **em sequência** (ordem estável por `id`), compartilhando saldo de coins.
2. **Exclusão de telefone por tenant** — telefone já contatado pela campanha A **não** entra na seleção da campanha B (lock permanente após Graph 200 / `messageId`).
3. **Failed Meta** — entrega `failed` **não** libera o telefone para outra campanha pool; não mostrar “retentar em outra campanha” para o mesmo número.
4. **Master off** — com config `enabled: false`, nenhum envio pool (UI deve deixar claro que campanhas individuais não disparam).

Notify “Tenho Interesse!” usa template/bindings da **campanha que enviou** o outreach; cashback continua no config master.

---

## Checklist QA manual

Marque após validação em ambiente com migration aplicada:

- [ ] Tenant com **duas** campanhas enabled, mesmo horário UTC, templates distintos — ambas rodam na mesma hora (sequencial no backend).
- [ ] Telefone contatado pela campanha A **não** aparece na seleção da campanha B no mesmo tenant.
- [ ] Envio com `lastStatus=failed` — telefone continua excluído de novas seleções pool.
- [ ] `PATCH outreach-config { "enabled": false }` — nenhum envio pool no próximo tick de cron.
- [ ] `GET /conversations?outreachCampaignId=<id>` retorna só threads com `prospecting.outreachCampaignId` correspondente.
- [ ] Tenant migrado possui campanha **Padrão** com schedule/categorias/templates equivalentes ao config antigo.

---

## Postman e seed local

- Collection: `postman/monodex.postman_collection.json` — pastas **Tenant — Outreach**, **Tenant — Outreach Campaigns**, queries em sends/conversations.
- Seed: `npx ts-node prisma/seed-outreach.ts` — config slim + campanha **Padrão** (ou reutiliza campanha existente pós-migration).
