# Integração front — número WhatsApp por tenant

Handoff para o PWA/Next (não vive neste repo). Use **este arquivo + Swagger**.

**Change:** `whatsapp-tenant-phone-assignment`  
**Swagger:** `swagger-spec.json` na raiz do monorepo, ou `GET /api` no gym-ctrl (Authorize → Bearer).  
**Breaking:** não. Paths iguais. Additive: campos novos em contas WhatsApp e no outreach config.

Login e JWT **não mudaram**: `POST /auth/login` → `{ "token": "<JWT>" }`. Tags `Platform — *` = `SUPER_ADMIN`. Tags `Tenant — *` = `ADMIN` no `jwt.tenantId`.

Cada **tenant** é um **cliente da plataforma**. `Tenant.phone` é o WhatsApp **do cliente** (aviso / welcome). O FROM dos envios é o `phoneNumberId` da conta da plataforma.

---

## O que mudou (produto)

Antes: um único número Cloud API para todos os clientes.

Agora:

- A plataforma tem **um WABA** e **N números** (`phoneNumberId`).
- Exatamente um número é **default** (`isDefault: true`) — compartilhado por clientes sem número próprio.
- Super Admin **atrelar** um número não-default a um cliente (`whatsappAccountId`).
- `null` = usa o default. Admin do tenant **não escolhe** o número.

Inbox, campanhas e outreach passam a sair pelo número resolvido daquele tenant. O front **não** escolhe FROM no reply.

---

## Checklist para o front

1. **Nova (ou evoluir) tela Super Admin — inventário WhatsApp** (`Platform — WhatsApp Accounts`): listar todos os números, badge Default, criar segundo número com o **mesmo** `wabaId` da default, promover default, **não** desligar a default, **nunca** enviar token Meta.
2. **Tela Super Admin — outreach do cliente** (`Platform — Outreach Config`): ao lado do preço, select de número dedicado. Opção “compartilhar default” = `whatsappAccountId: null`. Não listar a default como opção dedicada.
3. **Tela Admin do tenant — outreach**: mostrar `resolvedWhatsappAccount` **só leitura**. Não enviar `whatsappAccountId` no PATCH/PUT (403).
4. **Teste de template** Super Admin: `whatsappAccountId` opcional no body (schema `TestWhatsappTemplateDto`).
5. **Inbox / campanhas / grants / templates**: sem path novo. Catálogo continua um (WABA / default). Grants iguais.
6. Tipar o GET de outreach: o Swagger marca response como `object`; o shape real está abaixo (`whatsappAccountId` + `resolvedWhatsappAccount`).

---

## 1. Inventário de números — Super Admin

Tag Swagger: **Platform — WhatsApp Accounts**  
Schemas: `CreateWhatsappAccountDto`, `PatchWhatsappAccountDto`

| Método | Path |
|--------|------|
| GET | `/platform/whatsapp-accounts` |
| POST | `/platform/whatsapp-accounts` |
| GET | `/platform/whatsapp-accounts/:id` |
| PATCH | `/platform/whatsapp-accounts/:id` |

List/GET **não** devolvem access token. Campos da row:

```json
{
  "id": 1,
  "provider": "CLOUD_API",
  "phoneNumberId": "1292251013966333",
  "wabaId": "123456789012345",
  "displayPhone": "+5511999998888",
  "tokenEnvKey": "WHATSAPP_TOKEN",
  "tenantId": null,
  "enabled": true,
  "isDefault": true,
  "createdAt": "2026-08-18T00:00:00.000Z",
  "updatedAt": "2026-08-18T00:00:00.000Z"
}
```

### POST criar (required: `phoneNumberId`, `wabaId`)

```json
{
  "phoneNumberId": "outro-phone-number-id",
  "wabaId": "<copiar da conta isDefault>",
  "displayPhone": "+5511988887777",
  "tokenEnvKey": "WHATSAPP_TOKEN",
  "enabled": true,
  "isDefault": false
}
```

- Primeira conta da plataforma **sempre** nasce default, mesmo se mandar `isDefault: false`.
- Segunda conta: `wabaId` **igual** ao da default. Divergente → **400**.
- Não envie `tenantId` (não-null → **400**). Não envie `accessToken` / `token`.
- `tokenEnvKey` é o **nome** da env var no servidor (`WHATSAPP_TOKEN`), nunca o secret.

### PATCH promover default

```json
{ "isDefault": true }
```

A anterior perde o flag na mesma transação. Só um default.

### UI — regras

| Ação | Como |
|------|------|
| Badge Default | `isDefault === true` |
| Label humano | `displayPhone` ou `phoneNumberId` |
| Criar 2º número | copiar `wabaId` da default; outro `phoneNumberId` |
| Desligar número | `PATCH { "enabled": false }` só se **não** for default |
| Desligar default | **não oferecer** → API **400** |
| Campo tenantId | **não mostrar** |
| Campo token Meta | **não mostrar** |

---

## 2. Amarração no cliente — Super Admin

Tag Swagger: **Platform — Outreach Config**  
Schema PATCH: `PatchPlatformOutreachConfigDto`  
Schema PUT bootstrap: `UpsertOutreachConfigDto` (inclui `whatsappAccountId` opcional)

| Método | Path | Uso |
|--------|------|-----|
| GET | `/platform/tenants/:tenantId/outreach-config` | 404 se não houver |
| PUT | `/platform/tenants/:tenantId/outreach-config` | **só se ainda não existir** (pontapé) |
| PATCH | `/platform/tenants/:tenantId/outreach-config` | preço **e** número; sempre (não depende da janela de 30 min) |

### GET — campos novos (response real; Swagger 200 é `object`)

```json
{
  "id": 10,
  "tenantId": 4,
  "enabled": true,
  "costPerLead": 0.35,
  "cashbackOnReply": 0,
  "whatsappAccountId": null,
  "outreachTemplateId": 1,
  "notifyTemplateId": 2,
  "slotBindings": {},
  "schedule": { "2": [18] },
  "categories": ["contadores"],
  "leadsPerRun": 5,
  "sendIntervalSeconds": 5,
  "createdAt": "...",
  "updatedAt": "...",
  "outreachTemplate": { "id": 1, "name": "test_gladson", "language": "pt_BR", "status": "APPROVED" },
  "notifyTemplate": { "id": 2, "name": "lembrete_entrar_contato_interessado", "language": "pt_BR", "status": "APPROVED" },
  "resolvedWhatsappAccount": {
    "id": 1,
    "phoneNumberId": "1292251013966333",
    "displayPhone": null,
    "isDefault": true
  }
}
```

- `whatsappAccountId: null` = compartilhando o default.
- `resolvedWhatsappAccount` é o número **efetivo** do FROM (FK ou default). Use isso para o rótulo na UI.
- Se a FK aponta um dedicado: `whatsappAccountId` = id da conta, `resolvedWhatsappAccount.isDefault` = false.

### PATCH (schema Swagger)

```json
{ "whatsappAccountId": 2 }
```

```json
{ "whatsappAccountId": null }
```

```json
{ "costPerLead": 0.35, "cashbackOnReply": 0, "whatsappAccountId": 2 }
```

`whatsappAccountId` no schema: `number | null`, minimum 1 quando number.

### Select de número (Super Admin)

Opções:

1. **Compartilhar número default da plataforma** → persistir `null` (não o `id` da default).
2. Contas `GET /platform/whatsapp-accounts` com `enabled === true` **e** `isDefault === false`.

Não envie o id da default como dedicado → **400** (*use null para o remetente compartilhado*). Número já de outro cliente → **400**. Conta disabled → **400**.

Campos do Admin (`enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, `notifyTemplateId`) neste PATCH depois da janela de 30 min → **403**. Preço + número juntos: ok.

---

## 3. Admin do tenant — só leitura no número

Tag Swagger: **Tenant — Outreach Config**  
Schema PATCH: `PatchOutreachConfigDto` — **não** tem `whatsappAccountId` (whitelist). Se o raw body trouxer o campo → **403**.

| Método | Path |
|--------|------|
| GET | `/tenant/:tenantId/outreach-config` |
| PUT | `/tenant/:tenantId/outreach-config` | create se não existir; `whatsappAccountId` no body → 403; omitido persiste `null` |
| PATCH | `/tenant/:tenantId/outreach-config` | knobs; `costPerLead` / `cashbackOnReply` / `whatsappAccountId` → 403 |

GET devolve o **mesmo** shape (preço + `resolvedWhatsappAccount`).

Na UI operacional:

- Se `resolvedWhatsappAccount.isDefault`: texto do tipo “Número compartilhado da plataforma” + `displayPhone` / `phoneNumberId`.
- Senão: “Número dedicado” + `displayPhone` / `phoneNumberId`.
- **Sem** `<select>` de conta.

---

## 4. Teste de template — Super Admin

Tag: **Platform — WhatsApp Templates**  
Schema: `TestWhatsappTemplateDto`  
`POST /platform/whatsapp-templates/:id/test`

```json
{
  "to": "11999999999",
  "variables": { "body.1": "Demo" },
  "leadId": 1,
  "whatsappAccountId": 2
}
```

- `to` required.
- `whatsappAccountId` opcional: omitido = default; informado = esse `phoneNumberId`.
- Template continua no catálogo da **default** (sync não duplica por número).
- Sem `TenantLead` / coin.

`POST /platform/whatsapp-templates/sync` e `GET /platform/whatsapp-templates` **não mudam** para o front.

---

## 5. O que **não** muda no front

| Superfície | Ação |
|------------|------|
| Inbox `GET/POST /tenant/:tenantId/lead-lists/.../messages` | Paths iguais. Reply já sai pelo número resolvido. Sem seletor de FROM. |
| Campanhas de lista | Sem campo de conta WhatsApp. |
| Grants de template | Continua Super Admin; Admin só escolhe ids granted. |
| `Tenant.phone` | Continua o WhatsApp do **cliente** (welcome / notify TO), paths `/platform/tenants/:id` e `/tenant/:tenantId`. |
| Auth | JWT, roles, prefixos `/platform` vs `/tenant`. |

---

## Erros úteis para toast

| HTTP | Onde | Motivo típico |
|------|------|----------------|
| 400 | POST/PATCH account | `wabaId` diferente da default; `tenantId` comercial; `phoneNumberId` duplicado; disable da default; promover conta amarrada a um tenant |
| 400 | PATCH outreach platform | `whatsappAccountId` = id da default; número já de outro tenant; conta disabled / inexistente |
| 403 | PATCH/PUT tenant outreach | body com `whatsappAccountId`, `costPerLead` ou `cashbackOnReply` |
| 403 | PATCH platform outreach | body com knobs do Admin depois da janela de 30 min |
| 404 | GET outreach | config ainda não criada |

Mensagens da API vêm em português (ex.: *Não é possível atribuir a conta default; use null para o remetente compartilhado*).

---

## Como conferir no Swagger

1. Suba o gym-ctrl → `http://<host>:<GYM_PORT>/api`.
2. Authorize com JWT `SUPER_ADMIN`.
3. Tag **Platform — WhatsApp Accounts**: `isDefault` em create/patch.
4. Tag **Platform — Outreach Config**: PATCH schema com `whatsappAccountId`.
5. Tag **Platform — WhatsApp Templates**: test com `whatsappAccountId` opcional.
6. Troque para JWT `ADMIN` e tente PATCH tenant com `whatsappAccountId` → 403.

O arquivo `swagger-spec.json` na raiz espelha esses schemas (`CreateWhatsappAccountDto`, `PatchWhatsappAccountDto`, `PatchPlatformOutreachConfigDto`, `UpsertOutreachConfigDto`, `TestWhatsappTemplateDto`). O GET de outreach não tem schema nomeado: use o JSON de exemplo deste doc.
