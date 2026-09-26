# Task 1 — Schema e migration

**Change:** `tenant-outreach-campaigns`
**Group:** 1 of 6
**Prerequisites:** none
**Unlocks:** [task-02](./task-02-shared-policy-e-phone-exclusion.md), [task-03](./task-03-notifly-runs-e-contactleads-por-campanha.md), [task-04](./task-04-gym-ctrl-config-e-crud-de-campanhas.md)

## Group objective

Introduce `TenantOutreachCampaign` and wire FKs so runtime and admin can persist multiple pool campaigns per tenant, with data migrated from the legacy single config.

## Context for the subagent

- Schema: `prisma/schema.prisma` — today `TenantOutreachConfig` has `tenantId @unique` and holds schedule, categories, templates, knobs.
- Mirror field shapes from `TenantListCampaign` where applicable (schedule JSON, slotBindings, leadsPerRun, sendIntervalSeconds).
- `OutreachSendRun` has optional `campaignId` for LIST; add `outreachCampaignId` for CITY (do not overload `campaignId`).
- `TenantLead` has optional `runId`; add `outreachCampaignId Int?` with FK to new table.
- Do NOT change list campaign models or on-demand tables in this group.

## Expected files on completion

| File | Action |
|------|--------|
| `prisma/schema.prisma` | edit |
| `prisma/migrations/*` | create |

---

## 1.1 — Adicionar model `TenantOutreachCampaign`, FKs em `OutreachSendRun` e `TenantLead`, unique `(tenantId, leadId)`

### What to do

Add model (table `tenant_outreach_campaigns`):

- `id`, `tenantId`, `name`, `enabled` (default false)
- `schedule` Json, `categories` Json, `leadsPerRun`, `sendIntervalSeconds`
- `outreachTemplateId`, `notifyTemplateId`, `slotBindings` Json (default `{}`)
- `cityId Int?` optional FK to `City` if `City` model exists in schema (else Int nullable without FK — match project pattern for city ids on `Lead.cityId`)
- `createdAt`, `updatedAt`
- Relation on `Tenant`: `outreachCampaigns TenantOutreachCampaign[]`

On `OutreachSendRun`:

- `outreachCampaignId Int?` + relation + `@@index([outreachCampaignId, status])`

On `TenantLead`:

- `outreachCampaignId Int?` + relation + index
- `@@unique([tenantId, leadId])` — may require dedupe migration step if duplicates exist (delete/merge duplicates before unique index)

### Acceptance criteria

- [ ] `npx prisma validate` succeeds
- [ ] New model matches design.md field split

### Do not

- Drop config columns yet (task 1.2)

---

## 1.2 — Migration: backfill campanha **Padrão** a partir de `TenantOutreachConfig` e remover colunas migradas do config

### What to do

SQL migration steps:

1. Create table + FKs from 1.1.
2. For each row in `tenant_outreach_configs`, `INSERT INTO tenant_outreach_campaigns` with `name = 'Padrão'`, copying: `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `outreachTemplateId`, `notifyTemplateId`, `slotBindings`. Set `cityId` NULL.
3. Backfill `tenant_leads.outreach_campaign_id` from the tenant's Padrão campaign where `message_id IS NOT NULL` (optional but recommended).
4. Backfill `outreach_send_runs.outreach_campaign_id` for OPEN/historical CITY runs where `campaign_id IS NULL` — attach to Padrão campaign for that tenant when channel=CITY.
5. Drop from `tenant_outreach_configs`: `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `outreachTemplateId`, `notifyTemplateId`, `slotBindings` (keep master `enabled`, pricing, whatsapp, coin debit, on-demand price).

Run `prisma migrate dev` with descriptive name.

### Acceptance criteria

- [ ] Every tenant with config gets exactly one Padrão campaign
- [ ] Config columns removed match design (no templates/schedule on config)

### Do not

- Change application TypeScript until later tasks (migration only is ok if build breaks briefly — prefer same PR continues in task 4)

---

## Group verification

- `npx prisma migrate deploy` on empty clone with seed
- SQL spot-check: `SELECT COUNT(*) FROM tenant_outreach_campaigns` equals tenants with config

## Handoff to next task

Schema ready; shared helpers and services can assume `TenantOutreachCampaign` exists and config is slim.
