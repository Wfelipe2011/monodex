## Why

Outreach and tenant notify still send Cloud API templates by **hardcoded shape** (template name strings, one positional body, header image, named notify params). The Meta WABA already holds the real templates; the backend cannot list them, validate slots, or bind values without code changes. Super-admins and the external frontend need a catalog, per-config bindings, a test send to any number, and a configurable sync (the captura scrape hour is also still hardcoded at 06:00).

## What Changes

- Persist `wabaId` (and later per-tenant reuse) on `WhatsappAccount`.
- Sync Meta message templates into a local catalog (`WhatsappMessageTemplate`) via `POST /admin/whatsapp-templates/sync` and a **configurable cron**.
- **BREAKING:** Remove `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, and `headerImageUrl` from `TenantOutreachConfig`. Replace with FKs to catalog rows plus a slot-binding map (literals + a small binding enum).
- Resolve bindings at send time (cron outreach + notify webhook) from catalog components — not hardcoded Graph payloads.
- `POST /admin/whatsapp-templates/:id/test` (`SUPER_ADMIN`): send to any destination with explicit variables and optional `leadId`; no `TenantLead`, no coin movement.
- Configurable `PlatformJobSchedule` for `WHATSAPP_TEMPLATE_SYNC` and `SCRAPE` (replace captura `@Cron('0 6 * * *')`).
- No screens in this repo; contracts for the external frontend only.

## Capabilities

### New Capabilities

- `whatsapp-template-catalog`: WABA on account, Graph sync, catalog rows, parsed slots, list API, test send.
- `template-slot-bindings`: per-outreach-config FKs + JSON bindings; resolver (literal, header image, lead/tenant/now fields); missing lead fields render as `—`.
- `platform-job-schedules`: persist and apply cron expressions for template sync and captura scrape.

### Modified Capabilities

- `tenant-outreach-config`: drop name/contact-text/header fields; require template FKs + bindings; enable rules change.
- `admin-platform-config`: WhatsApp account `wabaId`; template admin routes; outreach DTOs; job schedule admin.
- `cloud-outreach-runtime`: build Graph components from catalog + bindings; skip env fallbacks for contact text / header / notify named params.
- `platform-whatsapp-cloud`: platform account includes `wabaId` for template listing; still a single shared WABA for official sends.
- `scrape-catalog`: morning scrape hour is no longer hardcoded; it follows `PlatformJobSchedule` key `SCRAPE`.

## Impact

- Prisma: `WhatsappAccount`, new `WhatsappMessageTemplate`, new `PlatformJobSchedule`, `TenantOutreachConfig` breaking columns.
- gym-ctrl admin APIs (Swagger/Postman); notifly send path; captura scrape cron.
- Shared helpers under `@core/shared` for slot parse, payload build, binding resolve (used by gym-ctrl and notifly).
- Seed `prisma/seed-outreach.ts` must create/sync catalog then bind; existing tenant configs must be re-PUT after deploy.
- Token Meta remains env-only (`tokenEnvKey`). Graph needs `whatsapp_business_management` to list templates.
