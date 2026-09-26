## Context

Pool prospecting is driven by a single `TenantOutreachConfig` per tenant (`tenantId` unique). `LeadsService.handleCron` loads tenants with config `enabled` and matching schedule, then `contactLeads` uses config templates, categories, and `leadsPerRun`. `OutreachSendRunService.openCityRun` allows at most one OPEN CITY run per **tenant**. List outreach already uses `TenantListCampaign` with per-campaign schedule, templates, and runs keyed by `campaignId`.

Operators need N **Campanhas de prospecção** (pool global) with independent schedules and templates, shared tenant pricing and `TenantSendPolicy`, tenant-wide phone exclusion including after Meta `failed`, and inbox/metrics filtered by campaign.

## Goals / Non-Goals

**Goals:**

- Model `TenantOutreachCampaign` with CRUD under tenant Admin API.
- Run notifly cron per enabled campaign when master config `enabled` and campaign schedule match.
- Key CITY `OutreachSendRun` by `outreachCampaignId`; persist `outreachCampaignId` on `TenantLead`.
- Migrate existing config fields into one default campaign **Padrão**.
- Affirmative notify uses the **sending campaign's** notify template/bindings; cashback stays on config.
- Permanent pool lock for tenant+phone after any Graph-accepted city send (including `failed`); do not set `contacted=false` on city failed webhook.
- Conversation list + city sends + home ops support optional campaign filter and aggregate view.
- Master `TenantOutreachConfig.enabled` stops **pool/city campaigns only**.

**Non-Goals:**

- Changing list campaigns, on-demand sends, or scrape behavior.
- Per-campaign pricing, WhatsApp number, or coin debit trigger (remain on config).
- Admin UI in this repo (FRONT-INTEGRATION only).
- Unlock/retry same phone on another pool campaign after failed.

## Decisions

### 1. Entity name and API path

**Decision:** Prisma model `TenantOutreachCampaign`; REST `/tenant/:tenantId/outreach-campaigns`. UI label **Campanhas de prospecção** to distinguish from list campaigns.

**Alternatives:** Reuse `TenantListCampaign` with a discriminator — rejected (different lead source and policies).

### 2. Config vs campaign field split

**Decision:** `TenantOutreachConfig` keeps: `enabled` (master pool), `costPerLead`, `costPerOnDemandSend`, `cashbackOnReply`, `coinDebitOnStatus`, `whatsappAccountId`. Campaigns hold: `name`, `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `outreachTemplateId`, `notifyTemplateId`, `slotBindings`, optional `cityId`.

**Migration:** SQL inserts default campaign from config columns; then drop moved columns from config (or leave nullable deprecated one release — prefer drop in same migration after backfill).

### 3. OutreachSendRun linkage

**Decision:** Add `outreachCampaignId` FK on `OutreachSendRun` (nullable for historical CITY rows). `openCityRun({ tenantId, outreachCampaignId, targetCount })` mirrors `openListRun`.

### 4. Cron execution when schedules overlap

**Decision:** Hourly cron loads all campaigns with `enabled=true` and tenant master `enabled=true`, `Tenant.active=true`, phone set. Group by `tenantId`; process campaigns in stable `id` order **sequentially** so shared coin `available` and `pendingCity` stay consistent.

**Alternatives:** Parallel per tenant — rejected (balance race).

### 5. Phone exclusion (failed lock)

**Decision:** `cityUsedPhonesWhere` excludes any `TenantLead` for the tenant with non-null `messageId` (Graph acceptance), regardless of `lastStatus`. Remove webhook side effect `contacted: false` on city failed. Update shared helper comments and `cloud-outreach-runtime` spec.

**Alternatives:** Keep failed unlock — rejected per product.

### 6. Campaign city filter

**Decision:** Optional `cityId` on campaign intersects with `TenantSendPolicy` allow/deny. Validation on write: if `allowedCityIds.length === 1`, client MUST NOT send a different `cityId` (omit or match); API may hide field in OpenAPI description. If both policy arrays empty, `cityId` null means all cities.

### 7. Enable validation

**Decision:** Campaign `enabled=true` requires approved templates, grants, complete bindings (same rules as today on config). Master config `enabled=true` does **not** require templates on config (templates live on campaigns). At least one campaign may be enabled when master is on — not enforced globally.

### 8. Conversation provenance

**Decision:** Extend `GET /tenant/:tenantId/conversations` with optional query `q`, `outreachCampaignId`, `templateName`. Each thread includes `prospecting` object from latest `TenantLead` with `messageId` matching normalized conversation phone (campaign id, name, `templateName`).

### 9. TenantLead uniqueness

**Decision:** Add unique `(tenantId, leadId)` and use upsert on send path to avoid duplicate funnel rows if re-contact rules ever change.

## Risks / Trade-offs

- **[Risk] Breaking API clients reading schedule/templates from outreach-config** → FRONT-INTEGRATION documents moved fields; migration creates Padrão campaign.
- **[Risk] Historical CITY runs without campaign id** → nullable FK; metrics treat null as “legacy / Padrão” or omit campaign filter match.
- **[Risk] Permanent failed lock reduces pool over time** → accepted; list outreach still reaches same phones.
- **[Risk] Long cron tick for tenants with many campaigns** → sequential runs acceptable at expected scale; same pattern as many list campaigns.

## Migration Plan

1. Deploy migration: create `tenant_outreach_campaigns`, add FKs, backfill Padrão from config, copy data, drop moved columns from `tenant_outreach_configs`.
2. Deploy notifly + gym-ctrl with new cron and APIs.
3. Rollback: revert apps; DB rollback script restores config columns from campaign id=default (keep backup migration down).

## Open Questions

None — master switch scope (pool only) and failed lock confirmed.
