## Why

Tenants today have a single outreach configuration that drives all city/pool prospecting (one schedule, one template pair, one batch size). Operators need multiple independent **Campanhas de prospecção** running in parallel—same or different cities, categories, schedules, and templates—without leads colliding across campaigns, while keeping platform pricing, send policies, and list/on-demand outreach unchanged.

## What Changes

- Introduce **`TenantOutreachCampaign`** (N campanhas per tenant) with per-campaign: `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, outreach/notify templates and slot bindings, optional `cityId`.
- Slim **`TenantOutreachConfig`** to account/platform fields (master enable for pool prospecting only, pricing, cashback, WhatsApp assignment, coin debit trigger, on-demand price); move operational knobs to campaigns.
- **BREAKING**: City outreach cron runs per enabled campaign (not per tenant config schedule); `OutreachSendRun` CITY runs keyed by campaign id.
- **BREAKING**: Failed Meta delivery on city outreach **no longer** releases the phone for another pool campaign for the same tenant (permanent audience lock on that tenant+phone for pool selection); coin refund rules unchanged.
- Migrate existing tenants: one default campaign **"Padrão"** copied from current config fields.
- Admin CRUD API for campaigns; outreach sends and home metrics filterable by campaign; conversation list enriched with prospecting provenance and filters (`q`, campaign, template).
- Master **`TenantOutreachConfig.enabled`**: disables all pool/city campaigns only (not list campaigns or on-demand).

## Capabilities

### New Capabilities

- `tenant-outreach-campaigns`: Persist, validate, and expose CRUD for pool prospecting campaigns; city subset vs `TenantSendPolicy`; enable rules and template grants.

### Modified Capabilities

- `tenant-outreach-config`: Config becomes account/master switch and pricing; schedule/templates/categories/batch knobs removed from config requirements.
- `cloud-outreach-runtime`: Scheduler and selection per campaign; phone exclusion includes failed city sends; notify on reply uses sending campaign.
- `city-outreach-sends`: List/filter sends by outreach campaign.
- `whatsapp-conversation-inbox`: Thread list includes prospecting metadata and query filters.
- `tenant-home-ops`: Sends metrics optionally grouped or filtered by outreach campaign (pool only).

## Impact

- **Schema/migration**: New table, FK on `OutreachSendRun` and `TenantLead`, data migration from config → default campaign.
- **notifly**: `LeadsService`, cron, `OutreachSendRunService`, quota refill, webhook failed handling for city.
- **gym-ctrl**: Campaign controller/service, outreach config DTOs, conversations service, outreach-sends, home ops.
- **shared**: Send-policy validation helpers for campaign `cityId`.
- **Front** (out of repo): New Campanhas UI, updated config screen, filters on inbox and sends; FRONT-INTEGRATION handoff.
