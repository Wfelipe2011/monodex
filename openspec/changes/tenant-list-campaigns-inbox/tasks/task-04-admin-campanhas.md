# Task 4 — Admin — campanhas

**Change:** `tenant-list-campaigns-inbox`
**Grupo:** 4 de 8
**Pré-requisitos:** [task-02](./task-02-shared-recipient-bindings-e-helpers.md), [task-03](./task-03-admin-listas-e-leads.md)
**Desbloqueia:** [task-06](./task-06-notifly-cron-campanhas-e-reply-actions.md)

## Objetivo do grupo

CRUD de campanhas com validação de template/bindings/botões e consulta de sends com status.

## Contexto para o subagent

- Validação de bindings: reutilizar padrão de `apps/gym-ctrl/src/modules/admin/slot-bindings.validate.ts` — adaptar roles `send` e `notify`
- Catálogo: `WhatsappMessageTemplate` status `APPROVED`
- `buttonActions` shape:

```json
[{ "buttonIndex": 0, "label": "Tenho Interesse!", "action": "NOTIFY" }]
```

- Validar labels contra `extractQuickReplyButtons(template.components)` no enable
- Se action `NOTIFY`: exige `notifyTemplateId` + bindings notify completos

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `apps/gym-ctrl/src/modules/admin/list-campaigns.controller.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/list-campaigns.service.ts` | criar |
| `apps/gym-ctrl/src/modules/admin/list-campaign-bindings.validate.ts` | criar |
| DTOs campanha | criar |
| `admin.module.ts` | editar |

---

## 4.1 — CRUD campanhas

### O que fazer

**Endpoints:**

```
GET    /admin/tenants/:tenantId/lead-lists/:listId/campaigns
POST   /admin/tenants/:tenantId/lead-lists/:listId/campaigns
GET    /admin/tenants/:tenantId/lead-lists/:listId/campaigns/:campaignId
PUT    /admin/tenants/:tenantId/lead-lists/:listId/campaigns/:campaignId
PATCH  /admin/tenants/:tenantId/lead-lists/:listId/campaigns/:campaignId
```

Body mínimo (POST/PUT):
```json
{
  "name": "Campanha A",
  "enabled": false,
  "templateId": 1,
  "slotBindings": {
    "send": {
      "body.1": { "type": "literal", "value": "Olá" },
      "body.customer_name": { "type": "recipient.name" }
    }
  },
  "notifyTemplateId": 2,
  "notifySlotBindings": { "notify": { ... } },
  "buttonActions": [
    { "buttonIndex": 0, "label": "Tenho Interesse!", "action": "NOTIFY" }
  ],
  "schedule": { "2": [18], "4": [13] },
  "sendsPerRun": 5,
  "sendIntervalSeconds": 5
}
```

Validações:
- `sendsPerRun >= 1`, `sendIntervalSeconds >= 0`
- `enabled=true` → template APPROVED, todos slots required cobertos em `send`, notify completo se há NOTIFY action, button labels existem no template
- Rejeitar binding types fora do enum fechado (inclui `recipient.*`)

### Critérios de aceite

- [ ] Enable sem notify template quando NOTIFY configurado → 400
- [ ] Enable com bindings incompletos → 400

### Não fazer

- Executar envios (notifly task 6)

---

## 4.2 — Listagem sends e failed filter

### O que fazer

**`GET /admin/tenants/:tenantId/lead-lists/:listId/sends`**

Query params:
- `status=failed` (opcional) — filtra sends cujo `lastStatus === failed`
- `campaignId` (opcional)

Resposta inclui: send id, wamid, sentAt, lastStatus, listLead (id, name, phone), campaign (id, name), latest error se failed.

Implementação: join `TenantListSend` + `TenantListLead` + `TenantListCampaign`; opcional subquery último `WhatsappSendStatus`.

### Critérios de aceite

- [ ] Filtro failed retorna só sends com status failed
- [ ] SUPER_ADMIN only

### Não fazer

- Paginação avançada no MVP (limit 100 default OK)

---

## Verificação do grupo

Criar campanha disabled via API; tentar enable inválido → 400.

## Handoff

Campanhas persistidas; notifly cron lê `enabled` + schedule.
