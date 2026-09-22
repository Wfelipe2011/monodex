# Task 5 — Gym-ctrl — on-demand tenant e coverage enriquecida

**Change:** `scrape-lifecycle-on-demand-categories`
**Group:** 5 of 7
**Prerequisites:** [task-02-shared-categorias-e-lifecycle.md](./task-02-shared-categorias-e-lifecycle.md), [task-04-captura-on-demand-cursor.md](./task-04-captura-on-demand-cursor.md)
**Unlocks:** [task-07-postman-front-e-verificacao.md](./task-07-postman-front-e-verificacao.md)

## Group objective

Tenant ADMIN routes to trigger and inspect on-demand scrapes; platform coverage API exposes lifecycle fields.

## Context for the subagent

- Controller: `apps/gym-ctrl/src/modules/admin/tenant-scrape-targets.controller.ts` — add nested routes under `tenant/:tenantId/scrape-targets/:targetId/on-demand`.
- Service: extend `TenantScrapeTargetsService` or new `TenantScrapeOnDemandService`.
- HTTP client to captura: follow `apps/notifly/src/inbox-realtime-notify.service.ts` pattern (fetch + env base URL + secret).
- Coverage: `apps/gym-ctrl/src/modules/admin/scrape-coverages.service.ts` — include new columns in list DTO.
- Quota: count `ScrapeOnDemandRun` where `startedAt` in SP local day — helper for day bounds.

## Expected files on completion

| File | Action |
|------|--------|
| `tenant-scrape-targets.controller.ts` | edit |
| New service + DTOs | create |
| `scrape-coverages.service.ts` | edit |
| `admin.module.ts` | edit if needed |
| Env validation in gym module for captura URL/secret | edit |

---

## 5.1 — POST/GET/PATCH on-demand

### What to do

Routes:

- `POST .../scrape-targets/:targetId/on-demand` → validate link, policy, `onDemandEnabled`, quota < 2, target `onDemandAllowed`, then HTTP POST captura internal; map 409 to HttpException.
- `GET .../on-demand` → `{ runsUsedToday, dailyLimit: 2, nextBairroIndex, bairroCount, onDemandEnabled, lastRun? }`
- `PATCH .../on-demand` body `{ onDemandEnabled: boolean }`

### Acceptance criteria

- [ ] Third POST same day → 429
- [ ] No link → 404

### Do not

- Set `ScrapeTarget.enabled` on PATCH

---

## 5.2 — Quota e lock

### What to do

Implement `countRunsToday(tenantId, targetId)` using America/Sao_Paulo boundaries.

Propagate captura conflict when lock held as 409 with message retry later.

### Acceptance criteria

- [ ] Quota enforced before HTTP call to captura

---

## 5.3 — Coverage platform fields

### What to do

Extend GET `platform/scrape-coverages` response with `schedulePhase`, `nextScheduledRunAt`, `scheduledRunCount`, `lastRunKind`.

Swagger metadata update via existing controller decorators.

### Acceptance criteria

- [ ] SUPER_ADMIN list shows new fields

---

## Group verification

Integration test or service spec with mocked fetch to captura.

## Handoff to next task

Postman can document routes; front uses GET status before POST.
