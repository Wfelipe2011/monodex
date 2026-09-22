# Task 6 — Gym-ctrl — outreach categorias restritas

**Change:** `scrape-lifecycle-on-demand-categories`
**Group:** 6 of 7
**Prerequisites:** [task-02-shared-categorias-e-lifecycle.md](./task-02-shared-categorias-e-lifecycle.md)
**Unlocks:** [task-07-postman-front-e-verificacao.md](./task-07-postman-front-e-verificacao.md)

## Group objective

Expose eligible outreach categories and reject tenant writes outside the scrape catalog (**BREAKING**).

## Context for the subagent

- Service: `apps/gym-ctrl/src/modules/admin/outreach-config.service.ts` — tenant PATCH/PUT via `UpsertTenantOutreachConfigDto` / `PatchOutreachConfigDto`.
- Controllers: `TenantOutreachConfigController` at `tenant/:tenantId/outreach-config`.
- Platform routes at `platform/tenants/:tenantId/outreach-config` — super-admin bypass: allow any category present on any **enabled** `ScrapeTarget` globally (no city filter per spec).
- Load send policy from `TenantSendPolicy` when building tenant allow-list.

## Expected files on completion

| File | Action |
|------|--------|
| `outreach-config.controller.ts` | edit |
| `outreach-config.service.ts` | edit |
| New method `getEligibleCategories(tenantId)` | edit |
| `outreach-config.service.spec.ts` | edit/create |

---

## 6.1 — GET eligible-categories

### What to do

Add `GET tenant/:tenantId/outreach-config/eligible-categories` (ADMIN guard).

Response:

```json
{
  "categories": ["Construtoras", "Clínicas médicas"],
  "items": [{ "category": "Construtoras", "cityId": 1, "cityName": "Taubaté" }]
}
```

Query enabled targets + cities; filter with shared helper.

### Acceptance criteria

- [ ] Sorted distinct categories
- [ ] Respects allow/deny city lists

---

## 6.2 — Validar writes tenant

### What to do

In tenant-owned create/update paths, when `categories` present, ensure every element ∈ allow-list (case-sensitive match to stored target category strings — document no normalization).

Return 400 with list of invalid entries.

Platform super-admin upsert: validate ⊆ all enabled target categories globally.

### Acceptance criteria

- [ ] Tenant invalid category rejected
- [ ] Platform can set category not in tenant city filter if globally scraped

### Do not

- Auto-trim invalid categories silently on tenant PATCH

---

## 6.3 — Tests

### What to do

Spec cases: allowlist city, shared target from other tenant, reject phantom category, platform bypass.

### Acceptance criteria

- [ ] Service specs pass

---

## Group verification

Run outreach-config service tests.

## Handoff to next task

Postman + FRONT-INTEGRATION document breaking change and new GET.
