# Task 5 — Gym-ctrl — leituras operacionais

**Change:** `tenant-outreach-campaigns`
**Group:** 5 of 6
**Prerequisites:** [task-03](./task-03-notifly-runs-e-contactleads-por-campanha.md), [task-04](./task-04-gym-ctrl-config-e-crud-de-campanhas.md)
**Unlocks:** [task-06](./task-06-postman-front-integration-e-verificacao.md)

## Group objective

Operators can filter sends, conversations, and home metrics by outreach campaign while keeping aggregate views.

## Context for the subagent

- Sends: `apps/gym-ctrl/src/modules/admin/outreach-sends.controller.ts` + service
- Conversations: `apps/gym-ctrl/src/modules/admin/conversations.service.ts` — `listConversations(tenantId)` no query params today
- Home: `apps/gym-ctrl/src/modules/admin/ops.service.ts` — `GET tenant/:tenantId/ops/home`

Phone normalization: use same as `@core/shared/list-campaign-helpers` `normalizeListPhone` when joining TenantLead to conversation phone.

## Expected files on completion

| File | Action |
|------|--------|
| `apps/gym-ctrl/src/modules/admin/outreach-sends.*` | edit |
| `apps/gym-ctrl/src/modules/admin/conversations.service.ts` | edit |
| `apps/gym-ctrl/src/modules/admin/conversations.controller.ts` | edit |
| `apps/gym-ctrl/src/modules/admin/ops.service.ts` | edit |
| DTO/swagger for sends/conversations/home | edit |
| `conversations.service.spec.ts`, `ops.service.spec.ts` | edit |

---

## 5.1 — Filtro `outreachCampaignId` em outreach sends + campos campaign na resposta

### What to do

Add optional query param `outreachCampaignId` to tenant and platform outreach sends endpoints.

Include `outreachCampaignId` and `outreachCampaignName` (join campaign) on each row.

### Acceptance criteria

- [x] Filter returns subset; omit returns all pool sends
- [x] List sends still exclude TenantListSend

---

## 5.2 — Conversations: `prospecting`, query `q` / `outreachCampaignId` / `templateName`

### What to do

Extend controller to pass query DTO: `q`, `outreachCampaignId`, `templateName`.

For each thread, resolve latest `TenantLead` where `tenantId`, normalized phone match, `messageId not null`, order by `createdAt desc`.

Map to `prospecting: { outreachCampaignId, outreachCampaignName, lastOutreachTemplateName } | null`.

Apply filters in SQL/Prisma where possible (avoid N+1 — batch load leads by phones).

### Acceptance criteria

- [x] Filter by campaign id excludes non-matching threads
- [x] Search q matches displayName or phone

---

## 5.3 — Home ops: `sends.byOutreachCampaign`

### What to do

In ops home builder, after computing `sends.today` / `sends.yesterday`, add array grouped by `outreachCampaignId` for TenantLead rows with messageId only (pool sends).

Each entry: campaign id, name, same status buckets for today/yesterday in America/Sao_Paulo.

### Acceptance criteria

- [x] Sum of campaign today totals equals pool portion of aggregate (list sends excluded from breakdown)

---

## Group verification

Unit tests for conversation filter and ops breakdown.

## Handoff to next task

Postman + FRONT-INTEGRATION document query params and response shapes.
