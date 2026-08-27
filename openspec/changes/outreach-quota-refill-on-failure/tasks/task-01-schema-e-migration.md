# Task 1 — Schema e migration

**Change:** `outreach-quota-refill-on-failure`
**Grupo:** 1 de 6
**Pré-requisitos:** nenhum
**Desbloqueia:** [2](./task-02-servico-de-run-e-refill-notifly.md), [3](./task-03-city-outreach-abrir-run-e-graph-fail-refill.md), [4](./task-04-list-campaigns-abrir-run-e-graph-fail-refill.md), [5](./task-05-webhook-failed-billing-hooks.md)

## Objetivo do grupo

Persistir execuções de envio (city/list) e amarrar cada Graph accept ao run, com campos para TTL, contadores e idempotência de refill.

## Contexto para o subagent

- Schema: `prisma/schema.prisma` — modelos `TenantLead` (~L155), `TenantListSend` (~L578), `TenantListCampaign`, `Tenant`.
- Migrations existentes usam timestamp prefix + SQL manual (ex. `prisma/migrations/20260821152400_configurable_coin_debit_on_status/migration.sql`).
- Enums Prisma no projeto: `WhatsappDeliveryStatus`, `CoinDebitOnStatus`, etc.
- Design: `../design.md` decisões D1 (tabela única), D3 (`tryCount` + `attemptCount`), TTL 1h.
- Spec: `../specs/outreach-send-run/spec.md`.
- **Não** alterar gym-ctrl, on-demand, nem lógica notifly além do schema neste grupo.
- Mapear tabelas em snake_case (`@@map`).

## Arquivos esperados ao concluir

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | editar |
| `prisma/migrations/<timestamp>_outreach_send_runs/migration.sql` | criar |

---

## 1.1 — Enums e model OutreachSendRun

### O que fazer

Adicionar ao Prisma:

```prisma
enum OutreachSendRunChannel {
  CITY
  LIST
}

enum OutreachSendRunStatus {
  OPEN
  CLOSED
}

enum OutreachSendRunClosedReason {
  TARGET_MET
  ATTEMPT_CAP
  EXHAUSTED
  TTL
  SUPERSEDED
}

model OutreachSendRun {
  id           Int                          @id @default(autoincrement())
  channel      OutreachSendRunChannel
  tenantId     Int                          @map("tenant_id")
  tenant       Tenant                       @relation(fields: [tenantId], references: [id])
  campaignId   Int?                         @map("campaign_id")
  campaign     TenantListCampaign?          @relation(fields: [campaignId], references: [id])
  targetCount  Int                          @map("target_count")
  tryCount     Int                          @default(0) @map("try_count")
  attemptCount Int                          @default(0) @map("attempt_count")
  chargedCount Int                          @default(0) @map("charged_count")
  status       OutreachSendRunStatus        @default(OPEN)
  closedReason OutreachSendRunClosedReason? @map("closed_reason")
  expiresAt    DateTime                     @map("expires_at")
  cityLeads    TenantLead[]
  listSends    TenantListSend[]
  createdAt    DateTime                     @default(now()) @map("created_at")
  updatedAt    DateTime                     @updatedAt @map("updated_at")

  @@index([tenantId, channel, status])
  @@index([campaignId, status])
  @@index([expiresAt])
  @@map("outreach_send_runs")
}
```

- Relação inversa em `Tenant` e `TenantListCampaign`.
- `expiresAt` = `createdAt + 1 hour` (set no código ao abrir; coluna obrigatória).

### Critérios de aceite

- [ ] Model e enums compilam no `schema.prisma`
- [ ] Índices cobrem lookup de OPEN por tenant/channel e por campaign

### Não fazer

- Não criar endpoints Admin
- Não backfill de runs históricos

---

## 1.2 — runId e refillTriggeredAt nos sends

### O que fazer

Em `TenantLead` e `TenantListSend`:

- `runId Int?` FK → `OutreachSendRun`
- `refillTriggeredAt DateTime?` — setado na primeira vez que um `failed` (ou Graph-fail path) dispara refill para aquele send; impede double refill

Opcional útil: `wasPremium Boolean?` só em `TenantLead` para refill premium-aware sem recomputar (se preferir snapshot no send time).

### Critérios de aceite

- [ ] FKs nullable; rows antigas sem run continuam válidas
- [ ] `refillTriggeredAt` presente nos dois canais city/list

### Não fazer

- Não tornar `runId` obrigatório
- Não tocar `TenantOnDemandSend`

---

## 1.3 — Migration SQL

### O que fazer

- Criar pasta `prisma/migrations/<YYYYMMDDHHMMSS>_outreach_send_runs/`
- SQL: create enums, create table, alter `tenant_leads` / `tenant_list_sends`, FKs, indexes
- Rodar `npx prisma migrate` / generate conforme fluxo local do repo (`openspec/explore/01-checklist-rodar-local.md` se útil)
- Validar `prisma generate`

### Critérios de aceite

- [ ] Migration aplica em Postgres limpo/local
- [ ] Client Prisma regenerado com novos tipos

### Não fazer

- Não editar migrations antigas

---

## Verificação do grupo

- `schema.prisma` + SQL revisados; `prisma generate` OK.

## Handoff para próxima task

Grupo 2 implementa serviços notifly sobre esses models; assume `OutreachSendRun`, `runId`, `refillTriggeredAt` disponíveis no client.
