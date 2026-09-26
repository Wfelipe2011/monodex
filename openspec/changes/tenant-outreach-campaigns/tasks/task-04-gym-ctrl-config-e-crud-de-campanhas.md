# Task 4 — Gym-ctrl — config e CRUD de campanhas

**Change:** `tenant-outreach-campaigns`
**Group:** 4 of 6
**Prerequisites:** [task-01](./task-01-schema-e-migration.md), [task-02](./task-02-shared-policy-e-phone-exclusion.md)
**Unlocks:** [task-05](./task-05-gym-ctrl-leituras-operacionais.md), [task-06](./task-06-postman-front-integration-e-verificacao.md)

## Group objective

Expose slim outreach config and full CRUD for pool campaigns under tenant Admin API, mirroring list campaign validation patterns.

## Context for the subagent

- Config today: `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts`, DTOs in `dto/upsert-tenant-outreach-config.dto.ts`, `patch-outreach-config.dto.ts`, swagger `outreach-config.swagger.dto.ts`
- List campaigns reference: `apps/gym-ctrl/src/modules/admin/list-campaigns.controller.ts`, `list-campaigns.service.ts`
- Template grant validation: existing outreach config / list campaign enable checks
- Register module in `admin.module.ts`

## Expected files on completion

| File | Action |
|------|--------|
| `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` | edit |
| `apps/gym-ctrl/src/modules/admin/dto/*outreach-config*` | edit |
| `apps/gym-ctrl/src/modules/admin/outreach-campaigns.controller.ts` | create |
| `apps/gym-ctrl/src/modules/admin/outreach-campaigns.service.ts` | create |
| `apps/gym-ctrl/src/modules/admin/dto/*outreach-campaign*` | create |
| `apps/gym-ctrl/src/modules/admin/admin.module.ts` | edit |
| `outreach-config.service.spec.ts` | edit |

---

## 4.1 — Slim `OutreachConfigService`/DTOs (master + pricing; sem schedule/templates)

### What to do

Remove from tenant/platform upsert/patch DTOs and response: schedule, categories, leadsPerRun, sendIntervalSeconds, outreachTemplateId, notifyTemplateId, slotBindings.

Keep: enabled (master pool), cost fields, whatsapp, coinDebitOnStatus (platform).

Remove enable-time template/binding validation from config service (moved to campaigns).

Update tests that asserted template enable on config.

Response may include nested summary `campaignCount` or omit — optional.

### Acceptance criteria

- [x] GET config returns slim shape
- [x] Existing platform/tenant routes still work with breaking field removal documented

### Do not

- Delete campaign CRUD fields from DB

---

## 4.2 — `OutreachCampaignsController` + service + DTOs/Swagger

### What to do

`@Controller('tenant/:tenantId/outreach-campaigns')`:

- GET list, GET :id, POST, PATCH :id, DELETE :id (soft delete not required unless project pattern — use hard delete if list campaigns do)

Validation:

- Template grants + APPROVED + bindings when `enabled=true`
- `leadsPerRun >= 1`, `sendIntervalSeconds >= 0`
- `assertCampaignCityAllowed` from shared helper with tenant send policy (load on write)

Include template refs in response like list campaigns.

Auth: tenant ADMIN; Super Admin bootstrap window same as list campaigns.

### Acceptance criteria

- [x] CRUD round-trip in spec/service tests
- [x] Invalid cityId returns 400

---

## Group verification

- Swagger builds
- `outreach-config.service.spec.ts` + new campaign service tests pass

## Handoff to next task

Front can use `/outreach-campaigns`; operational endpoints add filters in task 5.
