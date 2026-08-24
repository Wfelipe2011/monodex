# Task 1 — Schema e migration

**Change:** `tenant-api-keys-on-demand-send`
**Grupo:** 1 de 8
**Pré-requisitos:** nenhum
**Desbloqueia:** [task-02](./task-02-shared-hash-de-chave-e-authguard-dual-mode.md), [task-03](./task-03-admin-grant-chaves-e-preco-on-demand.md), [task-04](./task-04-midia-upload-listagem-get-publico-e-cron-de-orfaos.md), [task-05](./task-05-gym-ctrl-send-on-demand-e-dual-auth-nas-rotas-existentes.md), [task-06](./task-06-notifly-billing-on-demand-webhook-e-reserva-unificada.md), [task-07](./task-07-agendas-api-e-worker-horario.md)

## Objetivo do grupo

Persistir grant de API, chaves, mídia, envio/agenda on-demand, terceiro preço, FK de status e os dois novos `PlatformJobKey`, com migration e seed.

## Contexto para o subagent

- Schema: `prisma/schema.prisma`.
- `Tenant` (~11): adicionar `apiAccessEnabled` e relações novas.
- `TenantOutreachConfig` (~369): já tem `costPerLead`, `cashbackOnReply`, `coinDebitOnStatus`. Adicionar `costPerOnDemandSend`.
- `WhatsappSendStatus` (~625): hoje `listSendId?` e `tenantLeadId?`. Adicionar `onDemandSendId?`.
- `PlatformJobKey` (~442): só `WHATSAPP_TEMPLATE_SYNC` e `SCRAPE`.
- Seed de jobs: `prisma/seed-outreach.ts` array `DEFAULT_SCHEDULES`.
- Convite já usa `tokenHash` SHA-256 — **não** misturar com API key (model novo).
- Não alterar gym-ctrl/notifly nesta task (só schema/seed/migration/gitignore).
- `npx prisma validate` e gerar migration.

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<ts>_tenant_api_keys_on_demand_send/migration.sql` | criar |
| `prisma/seed-outreach.ts` | editar (jobs + `costPerOnDemandSend` no create) |
| `.gitignore` | editar (`uploads/`) |

---

## 1.1 — Flags de grant e preço

### O que fazer

Em `Tenant`:

```prisma
apiAccessEnabled Boolean @default(false) @map("api_access_enabled")
```

Em `TenantOutreachConfig`:

```prisma
costPerOnDemandSend Float @default(0) @map("cost_per_on_demand_send")
```

### Critérios de aceite

- [ ] Default `apiAccessEnabled=false` e `costPerOnDemandSend=0`
- [ ] `npx prisma validate` passa

### Não fazer

- Não colocar o preço em `Tenant` nem em `TenantLeadList`
- Não reusar `costPerSend` da lista

---

## 1.2 — Models de chave, mídia, send e agenda

### O que fazer

Enums:

```prisma
enum OnDemandSendSource {
  ADMIN_JWT
  API_KEY
  SCHEDULE
}

enum OnDemandScheduleStatus {
  PENDING
  CANCELLED
  SENT
  FAILED
}
```

`TenantApiKey`: `tenantId`, `name`, `prefix`, `keyHash` `@unique`, `lastUsedAt?`, `revokedAt?`, timestamps. Index `[tenantId, revokedAt]`.

`TenantMedia`: `publicId` `@unique` `@default(uuid())`, `tenantId`, `originalFileName`, `mimeType`, `relativePath`, `byteSize`, timestamps. Index `[tenantId, createdAt]`.

`TenantOnDemandSend`: `tenantId`, `templateId` (FK `WhatsappMessageTemplate`, Restrict), `phone`, `wamid` `@unique`, `variables` Json, `mediaId?`, `source`, `apiKeyId?`, `scheduleId?`, `lastStatus` `WhatsappDeliveryStatus?`, `coinDebitedAt?`, `coinRefundedAt?`, `conversationId?`, `sentAt` default now. Index `[tenantId, sentAt]`.

`TenantOnDemandSchedule`: `tenantId`, `templateId`, `phone`, `scheduledFor`, `variables` Json, `mediaId?`, `leadId?` (opcional, sem FK obrigatória a Lead se complicar — `Int?` basta), `status` default `PENDING`, `failedReason?`, `onDemandSendId?` unique opcional, `cancelledAt?`, timestamps. Index `[status, scheduledFor]`.

Ligar relações em `Tenant`, `WhatsappMessageTemplate`, `WhatsappConversation` se `conversationId` for FK.

### Critérios de aceite

- [ ] `keyHash` unique; `publicId` unique; `wamid` unique no send
- [ ] Timestamps de coin no send on-demand (mesmo padrão de `TenantListSend`)

### Não fazer

- Não store plaintext da chave
- Não reusar `TenantLead` / `TenantListSend` para este canal

---

## 1.3 — Status Meta e job keys

### O que fazer

Em `WhatsappSendStatus`:

```prisma
onDemandSendId Int? @map("on_demand_send_id")
onDemandSend   TenantOnDemandSend? @relation(...)
```

Em `PlatformJobKey` adicionar `ORPHAN_MEDIA_CLEANUP` e `ON_DEMAND_SCHEDULE_RUN`.

### Critérios de aceite

- [ ] Enum Prisma inclui os dois novos valores
- [ ] FK opcional em status, analogamente a `listSendId`

### Não fazer

- Não tornar `listSendId`/`tenantLeadId` obrigatórios
- Não criar constraint XOR no banco (fica no código, grupo 6)

---

## 1.4 — Migration, seed, gitignore

### O que fazer

- `npx prisma migrate dev --name tenant_api_keys_on_demand_send` (ou `migrate diff` + SQL se o ambiente preferir).
- Em `prisma/seed-outreach.ts` `DEFAULT_SCHEDULES`: upsert dos dois jobs (`0 3 1,16 * *` e `0 * * * *`, tz `America/Sao_Paulo`, enabled true). No create de `TenantOutreachConfig`, setar `costPerOnDemandSend: 0` (update **não** resetar se a row já existe).
- `.gitignore`: `/uploads/` (e `uploads/tenant-media/` se quiser mais específico).

### Critérios de aceite

- [ ] Migration aplica em Postgres limpo
- [ ] Seed idempotente cria os dois `PlatformJobSchedule`
- [ ] Pasta de upload não é commitável

### Não fazer

- Não mudar defaults dos jobs `SCRAPE` / `WHATSAPP_TEMPLATE_SYNC`
- Não implementar workers nesta task

---

## Verificação do grupo

`npx prisma validate`; migration presente; schema contém os quatro models e os dois job keys.

## Handoff para próxima task

Schema pronto para AuthGuard/CRUD. `costPerOnDemandSend` e `apiAccessEnabled` ainda sem API (grupo 3).
