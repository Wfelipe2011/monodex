# Task 3 — Notifly — runs e contactLeads por campanha

**Change:** `tenant-outreach-campaigns`
**Group:** 3 of 6
**Prerequisites:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-policy-e-phone-exclusion.md)
**Unlocks:** [task-05](./task-05-gym-ctrl-leituras-operacionais.md), [task-06](./task-06-postman-front-integration-e-verificacao.md)

## Group objective

Run pool prospecting per `TenantOutreachCampaign` with per-campaign runs, templates, notify on reply, and permanent phone lock on webhook failed.

## Context for the subagent

- Main files: `apps/notifly/src/leads.service.ts`, `apps/notifly/src/outreach-send-run.service.ts`, `apps/notifly/src/outreach-quota-refill.service.ts`, `apps/notifly/src/webhook-persistence.service.ts`
- Reference pattern: `apps/notifly/src/list-campaigns.service.ts` (cron per entity, `openListRun`)
- `contactLeads` today takes `TenantWithOutreach` with single config — refactor to campaign + slim config
- Master gate: skip if `!tenant.outreachConfig.enabled`
- Register city sender in quota refill must pass campaign context

## Expected files on completion

| File | Action |
|------|--------|
| `apps/notifly/src/outreach-send-run.service.ts` | edit |
| `apps/notifly/src/leads.service.ts` | edit |
| `apps/notifly/src/leads.service.spec.ts` | edit |
| `apps/notifly/src/outreach-quota-refill.service.ts` | edit |
| `apps/notifly/src/webhook-persistence.service.ts` | edit |
| `apps/notifly/src/webhook-persistence.service.spec.ts` | edit |

---

## 3.1 — `OutreachSendRunService.openCityRun` por `outreachCampaignId`

### What to do

Change signature to `openCityRun({ tenantId, outreachCampaignId, targetCount })`.

Find existing OPEN run where `channel=CITY`, `outreachCampaignId`, `status=OPEN`, not expired — return null if exists.

Create run with `outreachCampaignId` set.

Update all callers (leads service, quota refill).

### Acceptance criteria

- [ ] Two campaigns same tenant can both have OPEN CITY runs
- [ ] Same campaign cannot double-open

---

## 3.2 — Refatorar cron e `contactLeads` para campanha

### What to do

`handleCron`:

- Query `tenantOutreachCampaign.findMany({ where: { enabled: true, tenant: { active: true, outreachConfig: { enabled: true }, phone not empty }}})` with includes: templates, tenant outreachConfig, sendPolicy.
- Filter by `isWithinSchedule(campaign.schedule, day, hour)`.
- Group by tenantId; sort campaigns by id; call `contactLeadsForCampaign(campaign)` sequentially per tenant.

`contactLeadsForCampaign`:

- Use campaign categories, templates, bindings, `leadsPerRun`, `sendIntervalSeconds`, optional `cityId` (AND with `cityIdFilter` from policy).
- `costPerLead` from config.
- Remove dependency on config schedule/categories/templates.

Apply campaign `cityId` in Prisma where: if set, `lead.cityId === campaign.cityId`.

### Acceptance criteria

- [ ] Spec scenarios: master off skips; two campaigns same hour both run
- [ ] `leads.service.spec.ts` updated for campaign-shaped input

### Do not

- Change list campaign cron

---

## 3.3 — Notify afirmativo e persistência com `outreachCampaignId`; upsert `TenantLead`

### What to do

In send path (`sendCityLead`): set `outreachCampaignId` on create; use **upsert** on `@@unique([tenantId, leadId])` instead of bare create.

In `responseLeads` (affirmative reply): load campaign by `tenantLead.outreachCampaignId` for notify template/bindings; fallback to Padrão campaign if null (legacy rows).

Cashback still from `outreachConfig.cashbackOnReply`.

### Acceptance criteria

- [ ] Notify uses campaign notify template when lead has `outreachCampaignId`
- [ ] Graph accept sets campaign id on TenantLead

---

## 3.4 — Webhook: não setar `contacted=false` em failed de pool; quota refill alinhado

### What to do

In `webhook-persistence.service.ts`, remove `contacted: false` branch for `tenantLead` on `failed` (keep `lastStatus` update).

Update `outreach-quota-refill.service.ts` to load campaign when refilling CITY runs (uses `run.outreachCampaignId` for selection filters/templates).

Adjust specs in `webhook-persistence.service.spec.ts` (failed city no longer unlocks phone).

### Acceptance criteria

- [ ] Failed webhook test expects `contacted` unchanged (true)
- [ ] Refill still picks new phones excluding locked set

---

## Group verification

- `npm test` / project test runner for notifly module specs
- Manual: two campaigns different templates in logs when cron fires (if env allows)

## Handoff to next task

Runtime complete; gym-ctrl read APIs can expose campaign ids on sends/conversations.
