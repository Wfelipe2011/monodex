# Task 4 — Captura — on-demand curto e cursor

**Change:** `scrape-lifecycle-on-demand-categories`
**Group:** 4 of 7
**Prerequisites:** [task-01-schema-e-migration.md](./task-01-schema-e-migration.md), [task-03-captura-lifecycle-planned.md](./task-03-captura-lifecycle-planned.md)
**Unlocks:** [task-05-gym-ctrl-on-demand-e-coverage.md](./task-05-gym-ctrl-on-demand-e-coverage.md)

## Group objective

Internal endpoint runs short Maps scrapes with neighborhood cursor, logs runs, and never advances scheduled lifecycle.

## Context for the subagent

- Controller pattern: see `apps/gym-ctrl/src/modules/inbox-realtime/internal-inbox-realtime.controller.ts` + guard with shared secret.
- Captura module: `apps/captura/src/captura.module.ts` — register new controller + env `CAPTURA_INTERNAL_SCRAPE_SECRET` (or reuse monorepo internal secret naming).
- Refactor `GoogleMapsScraper.scrapeSorocabaLeads` to accept options: `{ categories, bairros, maxBairros?, startBairroIndex?, shortScroll? }` without breaking planned full run (defaults = current behavior).

Env defaults:

- `ON_DEMAND_MAX_BAIRROS=3`

## Expected files on completion

| File | Action |
|------|--------|
| `apps/captura/src/internal-scrape.controller.ts` | create |
| `apps/captura/src/captura-scraper.service.ts` | edit |
| `apps/captura/src/scraper/google-maps.scraper.ts` | edit |
| `apps/captura/src/captura.module.ts` | edit |
| Spec tests | create/edit |

---

## 4.1 — POST /internal/scrape/on-demand

### What to do

Body DTO:

```json
{ "tenantId": 4, "scrapeTargetId": 7 }
```

Validate secret header. Load target + city + category. Load or create `ScrapeOnDemandState`:

- If `bairroOrder` empty: load neighborhoods from DB, store stable sorted array in JSON, index 0.

Call `runOnDemandScrape` with slice of bairros `[index, index+MAX)`.

Return `{ status, leadsTouched, bairrosProcessed, nextBairroIndex }`.

### Acceptance criteria

- [ ] Invalid secret → 401
- [ ] Target disabled → 409 or 400

### Do not

- Advance `schedulePhase`

---

## 4.2 — Modo short no scraper

### What to do

When `maxBairros` set, only iterate that slice of bairro list (single category from target). Optionally reduce scroll iterations in `scrollMapsFeedUntilSettled` via parameter.

### Acceptance criteria

- [ ] Full planned run still processes all bairros when options omitted

### Do not

- Hardcode city name Sorocaba beyond existing scraper naming

---

## 4.3 — Persist run + cursor

### What to do

Insert `ScrapeOnDemandRun` at start (`running`) and finalize on completion.

Update state: `nextBairroIndex += bairrosProcessed`; wrap to 0 when >= length.

Update coverage `lastRunAt`, `lastLeadCount`, `lastRunKind=on_demand` only — **no** `advanceScheduleAfterPlannedRun`.

### Acceptance criteria

- [ ] Second call uses advanced index per spec scenario

---

## 4.4 — Tests

### What to do

Unit test cursor wrap and mock scraper invocation count. Controller test with secret.

### Acceptance criteria

- [ ] Tests pass in captura app

---

## Group verification

curl internal endpoint against local captura with secret (document in task 7).

## Handoff to next task

Gym-ctrl calls this HTTP from tenant POST on-demand.
