# Integração front — lifecycle de templates WhatsApp e business profile

Handoff para o PWA/Next (não vive neste repo) e Super Admin. Use **este arquivo + Swagger** (`swagger-spec.json` ou `GET /api` no gym-ctrl).

| | |
|--|--|
| **Change** | `whatsapp-template-lifecycle-and-profile` |
| **Breaking** | Não. Additive: `components` + campos de preview nas listagens tenant; novas rotas SUPER_ADMIN (CRUD template, media handle, business-profile). |
| **Auth** | JWT Bearer **ou** `X-API-KEY` nas rotas tenant allowlist (nunca os dois). Platform = só Bearer SUPER_ADMIN. |
| **Postman** | Pastas **Platform — WhatsApp Templates**, **Platform — WhatsApp Accounts**, **Tenant — Templates Granted** em `postman/monodex.postman_collection.json` |
| **Tags Swagger** | `Platform — WhatsApp Templates`, `Platform — WhatsApp Accounts`, `Tenant — WhatsApp Templates` |

**Fora de escopo desta change:** cadastrar / registrar telefone novo na Meta; fluxo de display name; UI React neste repo; CRUD de templates pelo Admin do tenant.

---

## TL;DR

1. **Preview (foco tenant):** `GET /tenant/:tenantId/whatsapp-templates` e `GET .../:templateId` devolvem `components` (shape Meta, com `BODY.text`) + `slots`. O front monta o bubble e substitui `{{1}}` com o mapa de variáveis — **sem** endpoint de preview server-side.
2. **Platform** usa o mesmo shape em list/get.
3. **SUPER_ADMIN** sobe imagem → handle → cria/edita template **MARKETING** → status tipicamente `PENDING` → grant separado; delete com FK → **409**.
4. **Business profile** é proxy live Graph em `GET|PATCH /platform/whatsapp-accounts/:id/business-profile` (foto via mesmo handle de media).
5. Env nova para upload: **`META_APP_ID`**.

---

## Preview client-side (como montar o bubble)

Resposta típica (tenant ou platform):

```json
{
  "id": 12,
  "metaId": "4578906895724819",
  "name": "lembrete_pagamento_vencido",
  "language": "pt_BR",
  "status": "APPROVED",
  "category": "MARKETING",
  "parameterFormat": "POSITIONAL",
  "slots": [
    {
      "key": "body.1",
      "component": "body",
      "paramType": "text",
      "format": "positional",
      "index": 1
    },
    {
      "key": "body.2",
      "component": "body",
      "paramType": "text",
      "format": "positional",
      "index": 2
    }
  ],
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Pagamento pendente"
    },
    {
      "type": "BODY",
      "text": "Olá, {{1}}! Seu pagamento vence em {{2}}. Regularize para manter o acesso.",
      "example": {
        "body_text": [["João", "30/08"]]
      }
    },
    {
      "type": "FOOTER",
      "text": "Mensagem automática"
    }
  ],
  "lastSyncedAt": "2026-08-24T12:00:00.000Z"
}
```

### Substituição no front

1. Encontre o component `type === "BODY"` (e HEADER TEXT / botões URL se houver placeholders).
2. Para cada slot, leia o valor do formulário pelo `key` (ex. `variables: { "body.1": "João", "body.2": "30/08" }`).
3. Substitua `{{1}}` / `{{2}}` (ou named) no `text` — **no cliente**.
4. Renderize HEADER → BODY → FOOTER → BUTTONS como bolha de chat; não chame Graph para preview.

Exemplo mínimo:

```ts
function previewBody(text: string, variables: Record<string, string>) {
  return text.replace(/\{\{(\d+)\}\}/g, (_, n) => variables[`body.${n}`] ?? `{{${n}}}`);
}

previewBody(
  'Olá, {{1}}! Seu pagamento vence em {{2}}.',
  { 'body.1': 'João', 'body.2': '30/08' },
);
// → "Olá, João! Seu pagamento vence em 30/08."
```

Header IMAGE: slot `header.image` — no preview use a URL/local file do form; no create Meta use `header_handle` do upload platform.

---

## 1. Preview tenant (foco)

Tag: **Tenant — WhatsApp Templates**  
Schema response: `WhatsappTemplatePreviewDto`

| Método | Path | Auth |
|--------|------|------|
| GET | `/tenant/:tenantId/whatsapp-templates` | JWT ADMIN (tenant scope) / SUPER_ADMIN **ou** `X-API-KEY` allowlist |
| GET | `/tenant/:tenantId/whatsapp-templates/:templateId` | idem |

- Só templates **granted** ao tenant. Sem grant → omitido na list; get → **404** (não revela catálogo global).
- Sem sync Graph nesta leitura.
- Shape = preview acima (`components` + `slots` + metadados).

Envio on-demand (já existente, fora do CRUD desta change): `POST .../:templateId/sends` — usa o mesmo mapa `variables` por slot key.

---

## 2. Preview platform

Tag: **Platform — WhatsApp Templates** · SUPER_ADMIN

| Método | Path | Notas |
|--------|------|-------|
| GET | `/platform/whatsapp-templates` | Query opcional `status`, `name`. Catálogo WABA default. |
| GET | `/platform/whatsapp-templates/:id` | 404 se id inexistente |
| POST | `/platform/whatsapp-templates/sync` | Sync Graph → catálogo (já existia) |

Mesmo `WhatsappTemplatePreviewDto`.

---

## 3. Lifecycle SUPER_ADMIN (MARKETING only)

Fluxo recomendado:

```
POST .../media (multipart) → { handle }
        ↓
POST /platform/whatsapp-templates  (components; IMAGE usa header_handle)
        ↓
row local status PENDING (+ metaId)
        ↓
(grant via Template Grants — rota já existente)
        ↓
PATCH .../:id  (full replace components; name/language imutáveis)
        ↓
DELETE .../:id  → 409 se FKs; senão Graph + remove local
```

### Upload media → handle

```http
POST /platform/whatsapp-templates/media
Authorization: Bearer <platformToken>
Content-Type: multipart/form-data

file: <jpeg|png, máx. 5 MB>
```

**201:** `{ "handle": "<opaco Meta>" }`

Requer **`META_APP_ID`** + token da conta default (`tokenEnvKey`). Não persiste em TenantMedia. Use o handle em:

- HEADER IMAGE `example.header_handle` no create/patch template, **ou**
- `profile_picture_handle` no PATCH business-profile.

### Create

```http
POST /platform/whatsapp-templates
```

```json
{
  "name": "lembrete_pagamento_vencido",
  "language": "pt_BR",
  "category": "MARKETING",
  "parameterFormat": "POSITIONAL",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "Pagamento pendente"
    },
    {
      "type": "BODY",
      "text": "Olá, {{1}}! Seu pagamento vence em {{2}}. Regularize para manter o acesso.",
      "example": { "body_text": [["João", "30/08"]] }
    },
    {
      "type": "FOOTER",
      "text": "Mensagem automática"
    }
  ]
}
```

- MVP: **somente** `category: "MARKETING"`. Outras → **400**.
- Variáveis exigem `example` no component; HEADER IMAGE exige handle.
- **Não** cria grants. Resposta = preview; status costuma ser **`PENDING`** até sync/aprovação Meta.

HEADER IMAGE (após media):

```json
{
  "type": "HEADER",
  "format": "IMAGE",
  "example": {
    "header_handle": ["<handle do POST /media>"]
  }
}
```

### Patch

```http
PATCH /platform/whatsapp-templates/:id
```

Body: `{ "components": [ ... ], "category": "MARKETING" }` (category opcional).  
Enviar `name` ou `language` → **400**. Exige `metaId` na row.

### Delete

```http
DELETE /platform/whatsapp-templates/:id
```

- Sucesso: `{ "deleted": true, "id": 12 }`
- **409** se grant / outreach / campanha / on-demand referencia o id — remova FKs antes; sem cascade.

---

## 4. Business profile (número Cloud API)

Tag: **Platform — WhatsApp Accounts** · SUPER_ADMIN  
Schema: `WhatsappBusinessProfileResponseDto` / `PatchWhatsappBusinessProfileDto`

| Método | Path |
|--------|------|
| GET | `/platform/whatsapp-accounts/:id/business-profile` |
| PATCH | `/platform/whatsapp-accounts/:id/business-profile` |

- Proxy **live** Graph com `phoneNumberId` + `tokenEnvKey` da conta `:id` (plataforma, `tenantId=null`). Não exige `isDefault`.
- Sem persistência Prisma do profile. Nunca devolve access token.
- **Não** cadastra / registra telefone; **não** altera display name nesta change.

PATCH whitelist: `about`, `address`, `description`, `email`, `websites` (máx. 2), `vertical`, `profile_picture_handle`.

```json
{
  "about": "Atendimento WhatsApp da plataforma",
  "email": "contato@example.com",
  "websites": ["https://example.com"],
  "profile_picture_handle": "<handle do POST /platform/whatsapp-templates/media>"
}
```

Resposta GET/PATCH: shape plano (`about`, `address`, …, `profile_picture_url` quando a Graph devolver).

---

## 5. Env nova

| Variável | Obrigatória para | Notas |
|----------|------------------|-------|
| `META_APP_ID` | `POST /platform/whatsapp-templates/media` | App ID do Meta Developer (Resumable Upload). Ausente → **400** claro. |
| Token via `tokenEnvKey` da conta | create/edit/delete/sync/profile/media | Já existente; nunca envie o secret no body. |

---

## 6. Tabela de permissões

| Ação | SUPER_ADMIN | ADMIN tenant (JWT) | Integrador (`X-API-KEY`) |
|------|-------------|--------------------|---------------------------|
| GET platform templates (list/get) | sim | — / 401 | 401 |
| POST media / create / patch / delete template | sim | 403 | 401 |
| GET/PATCH business-profile | sim | 403 | 401 |
| Sync templates | sim | 403 | 401 |
| GET tenant templates (list/get preview) | sim (scope) | sim | sim (allowlist) |
| POST tenant template sends | **403** | sim | sim |
| Template grants CRUD | sim (rotas platform grants) | — | 401 |
| Register / cadastrar telefone Meta | **não nesta API** | — | — |

---

## Smoke checklist

Use Postman ou curl com `platformToken` / `tenantToken`. Itens cobertos por testes unitários das tasks 1–4 estão marcados.

| # | Verificação | Auto (tasks 1–4) | Manual |
|---|-------------|------------------|--------|
| 1 | Sync ou create → `GET` tenant list mostra `components[].text` (BODY) | ✓ mapper/list | □ |
| 2 | Variável no front substitui `{{1}}` (manual no cliente) | — | □ |
| 3 | `POST` template MARKETING → row local (status PENDING típico) | ✓ create | □ |
| 4 | `DELETE` com grant → **409** | ✓ delete | □ |
| 5 | `GET` / `PATCH` profile `about` | ✓ profile | □ |
| 6 | Upload media → handle → header IMAGE create **ou** `profile_picture_handle` | ✓ media + create/profile | □ |
| 7 | `GET /tenant/.../whatsapp-templates/:id` sem grant → 404 | ✓ getGranted | □ |
| 8 | `GET /platform/whatsapp-templates/:id` preview com slots | ✓ getById | □ |

---

## Schemas OpenAPI

| Schema | Uso |
|--------|-----|
| `WhatsappTemplatePreviewDto` | list/get/create/patch response |
| `WhatsappTemplateDeletedDto` | delete sucesso |
| `MetaMediaHandleResponseDto` | POST media |
| `CreateWhatsappTemplateDto` / `PatchWhatsappTemplateDto` | body create/patch |
| `WhatsappBusinessProfileResponseDto` | GET/PATCH profile |
| `PatchWhatsappBusinessProfileDto` | body PATCH profile |

Regenere `swagger-spec.json` com:

```bash
npx ts-node -r tsconfig-paths/register apps/gym-ctrl/src/generate-swagger-spec.ts
```

(ou boot do gym-ctrl, que também escreve o arquivo na raiz).
