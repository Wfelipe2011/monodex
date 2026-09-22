# Task 3 — Captura — lifecycle planned e capacidade comercial

**Change:** `scrape-lifecycle-on-demand-categories`
**Group:** 3 of 7
**Prerequisites:** [task-01-schema-e-migration.md](./task-01-schema-e-migration.md), [task-02-shared-categorias-e-lifecycle.md](./task-02-shared-categorias-e-lifecycle.md)
**Unlocks:** [task-04-captura-on-demand-cursor.md](./task-04-captura-on-demand-cursor.md)

## Group objective

Planned cron scrapes only lifecycle-eligible targets, advances phases after runs, caps throughput during business hours, and locks per city-category pair.

## Context for the subagent

- Entry: `apps/captura/src/captura-scraper.service.ts` — `handleMorningScrape`, `runScrapeJob`, `upsertCoverage`.
- Cron: `apps/captura/src/dynamic-scrape-cron.service.ts` — unchanged wiring; still calls `handleMorningScrape`.
- Maps scraper: `apps/captura/src/scraper/google-maps.scraper.ts` — full run loops all bairros × categories.
- Use `advanceScheduleAfterPlannedRun` from shared after each category completes in planned mode.
- Set `lastRunKind = 'planned'` on coverage updates from planned path.

## Expected files on completion

| File | Action |
|------|--------|
| `apps/captura/src/captura-scraper.service.ts` | edit |
| Optional `apps/captura/src/scrape-pair-lock.service.ts` | create |
| `apps/captura/src/captura-scraper.service.spec.ts` | create/edit |

---

## 3.1 — Seleção elegível

### What to do

Replace `findMany({ where: { enabled: true } })` with:

1. Load enabled targets with left join coverage (Prisma: targets + separate coverage query keyed by cityId+category).
2. Filter with `isScheduledScrapeEligible(coverage, now)`.
3. Sort by `nextScheduledRunAt ASC NULLS FIRST`, then oldest `lastRunAt`.

Build `CityScrapeGroup[]` as today.

### Acceptance criteria

- [ ] Target in COOLDOWN_90D with future `nextScheduledRunAt` excluded
- [ ] BOOTSTRAP targets always included when enabled

### Do not

- Change upsert lead logic

---

## 3.2 — Avançar fase

### What to do

In `upsertCoverage` (planned path only), after writing counts/status, call `advanceScheduleAfterPlannedRun` and persist `schedulePhase`, `nextScheduledRunAt`, `scheduledRunCount`.

### Acceptance criteria

- [ ] Planned run with `lastLeadCount >= 1` from BOOTSTRAP sets COOLDOWN_90D
- [ ] Failed run with 0 leads in BOOTSTRAP does not advance phase

### Do not

- Call advance from on-demand code path (task 4)

---

## 3.3 — Capacidade horário comercial

### What to do

Before grouping, if local hour in `America/Sao_Paulo` is between 8 and 18 inclusive, slice eligible list to first K pairs (env `SCRAPE_BUSINESS_HOURS_MAX_TARGETS`, default 2).

Use `Intl` or `luxon`/`date-fns-tz` if already a dependency; else small helper with `toLocaleString` — prefer existing project pattern.

### Acceptance criteria

- [ ] At 10:00 SP at most 2 pairs start
- [ ] At 22:00 SP no K limit

### Do not

- Apply cap to on-demand

---

## 3.4 — Lock por par

### What to do

In-memory `Map<string, boolean>` key `cityId:category` or async mutex. Acquire before `scrape()` for pair; release in finally. If lock held, skip pair this tick (log warn).

On-demand (task 4) must use same lock.

### Acceptance criteria

- [ ] Concurrent planned + on-demand for same pair cannot overlap

---

## Group verification

Unit tests for selection sort/cap with mocked clock. Manual: log lines show skipped targets in cooldown.

## Handoff to next task

Planned path stable; on-demand reuses lock and scraper short mode.
