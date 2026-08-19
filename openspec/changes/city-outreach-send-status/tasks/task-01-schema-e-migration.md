# Task 1 — Schema e migration

**Change:** `city-outreach-send-status`
**Grupo:** 1 de 5
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02](./task-02-notifly-snapshot-no-contactleads.md), [task-03](./task-03-notifly-webhook-de-cidade.md), [task-04](./task-04-admin-api-de-listagem.md)

## Objetivo do grupo

Prisma: `TenantLead` guarda snapshot de envio de cidade (`lastStatus`, `templateName`, `messageId` unique) e `WhatsappSendStatus` aponta opcionalmente para esse lead. Backfill dos órfãos já gravados.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`.
- `TenantLead` (~linha 148): `messageId String? @map("message_id")` **sem** unique hoje. Flags de funil (`contacted`, `replied`, …) **não** mudam.
- Enum `WhatsappDeliveryStatus` já existe (`sent`, `delivered`, `read`, `failed`) — reutilizar; não criar outro.
- `WhatsappSendStatus` (~linha 567) já tem `listSendId Int?` → `TenantListSend`. Espelhar com `tenantLeadId`.
- `TenantListSend` **não** ganha campos nesta change.
- Captura cria `TenantLead` sem `messageId` (vários NULL). Unique Postgres em coluna nullable permite vários NULL.
- Migrations em `prisma/migrations/`. Padrão de nome: `YYYYMMDDHHMMSS_city_outreach_send_status`.
- Não alterar apps nesta task.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_city_outreach_send_status/migration.sql` | criar |

---

## 1.1 — Campos Prisma

### O que fazer

Em `TenantLead` adicionar (manter `messageId` como string de correlação Meta, **não** FK para `Message`):

```prisma
lastStatus   WhatsappDeliveryStatus? @map("last_status")
templateName String?                 @map("template_name")
messageId    String?                 @unique @map("message_id")
sendStatuses WhatsappSendStatus[]
```

Em `WhatsappSendStatus`:

```prisma
tenantLeadId Int?        @map("tenant_lead_id")
tenantLead   TenantLead? @relation(fields: [tenantLeadId], references: [id])
```

`listSendId` permanece. Não exigir XOR no banco (o webhook garante o isolamento).

### Critérios de aceite

- [ ] `lastStatus` usa o enum existente `WhatsappDeliveryStatus`
- [ ] `templateName` nullable; `messageId` unique nullable
- [ ] `tenantLeadId` nullable em `WhatsappSendStatus`
- [ ] `npx prisma validate` passa
- [ ] Nenhum campo novo em `TenantListSend`

### Não fazer

- Não criar tabela `TenantOutreachSend`
- Não tornar `messageId` obrigatório (captura/Baileys)
- Não alterar funil `contacted`/`replied`/`quoted`/`closed`/`deleted`

---

## 1.2 — Migration e backfill

### O que fazer

Gerar migration (`npx prisma migrate dev --name city_outreach_send_status` **ou** SQL equivalente no padrão das migrations existentes) e incluir:

1. `ALTER TABLE tenant_leads ADD COLUMN last_status "WhatsappDeliveryStatus"`
2. `ALTER TABLE tenant_leads ADD COLUMN template_name TEXT`
3. Unique em `tenant_leads.message_id` (coluna já existe)
4. `tenant_lead_id` em `whatsapp_send_statuses` nullable + FK para `tenant_leads(id)`
5. Backfill **sem** inventar `template_name`:

```sql
UPDATE whatsapp_send_statuses s
SET tenant_lead_id = tl.id
FROM tenant_leads tl
WHERE s.list_send_id IS NULL
  AND tl.message_id IS NOT NULL
  AND s.wamid = tl.message_id;

UPDATE tenant_leads tl
SET last_status = latest.status
FROM (
  SELECT DISTINCT ON (wamid) wamid, status
  FROM whatsapp_send_statuses
  ORDER BY wamid, meta_timestamp DESC
) latest
WHERE tl.message_id = latest.wamid;
```

Se o unique em `message_id` falhar por duplicata não-nula: **parar** e reportar; não deduplicar no silêncio.

Gerar client (`npx prisma generate`).

### Critérios de aceite

- [ ] SQL cria colunas/FK/unique
- [ ] Backfill liga órfãos (`list_send_id` null + wamid = `message_id`)
- [ ] `template_name` histórico permanece NULL
- [ ] Client Prisma gerado

### Não fazer

- Não backfillar `template_name` a partir de `tenant_outreach_configs`
- Não tocar `list_send_id` já preenchido
- Não alterar apps

---

## Verificação do grupo

- `npx prisma validate`
- Conferir que `TenantListSend.lastStatus` / `wamid` unique seguem iguais

## Handoff para próxima task

Colunas existem. Task 2 grava `templateName` no create. Task 3 preenche `tenantLeadId` + `lastStatus` no webhook. Task 4 lê os campos na API.
