# Task 2 — Shared — categorias elegíveis e helpers de lifecycle

**Change:** `scrape-lifecycle-on-demand-categories`
**Group:** 2 of 7
**Prerequisites:** [task-01-schema-e-migration.md](./task-01-schema-e-migration.md)
**Unlocks:** [task-05-gym-ctrl-on-demand-e-coverage.md](./task-05-gym-ctrl-on-demand-e-coverage.md), [task-06-gym-ctrl-outreach-categorias.md](./task-06-gym-ctrl-outreach-categorias.md), [task-03-captura-lifecycle-planned.md](./task-03-captura-lifecycle-planned.md)

## Group objective

Centralize eligibility rules for scheduled scrape and outreach category allow-list in `@core/shared` with unit tests.

## Context for the subagent

- Send policy helper: `cityAllowed` from `@core/shared/send-policy` (used in `tenant-scrape-targets.service.ts`).
- Lifecycle constants: 90 and 180 days — use UTC-safe date math or `date-fns` if already in monorepo; avoid magic in captura/gym-ctrl.
- Place new files under `libs/core/src/shared/` or existing shared scrape folder; follow nearby test patterns (`*.spec.ts` colocated).

## Expected files on completion

| File | Action |
|------|--------|
| `libs/core/src/shared/scrape-schedule.ts` (or similar) | create |
| `libs/core/src/shared/eligible-outreach-categories.ts` | create |
| `libs/core/src/shared/index.ts` or barrel | edit |
| `*.spec.ts` | create |

---

## 2.1 — eligibleOutreachCategories

### What to do

Export async function or pure function taking:

```typescript
type Input = {
  allowedCityIds: number[];
  deniedCityIds: number[];
  targets: Array<{ cityId: number; category: string; enabled: boolean }>;
};
```

Return sorted distinct `category` strings where `enabled === true` and `cityAllowed(cityId, allowed, denied)`.

Document: includes all enabled targets in allowed cities (global pool), not only tenant links — matches spec.

### Acceptance criteria

- [ ] Empty allow list + empty deny = all cities allowed (existing `cityAllowed` semantics)
- [ ] Deny list excludes categories from denied cities only

### Do not

- Query Prisma inside shared lib (keep pure; callers pass targets)

---

## 2.2 — isScheduledScrapeEligible

### What to do

Export:

```typescript
function isScheduledScrapeEligible(
  coverage: {
    schedulePhase: ScrapeSchedulePhase;
    nextScheduledRunAt: Date | null;
  } | null,
  now: Date,
): boolean;
```

Rules:

- `null` coverage → eligible (BOOTSTRAP)
- `BOOTSTRAP` → always eligible
- `COOLDOWN_90D` / `RECURRING_180D` → eligible iff `nextScheduledRunAt != null && now >= nextScheduledRunAt`

Export `advanceScheduleAfterPlannedRun(coverage, lastLeadCount, now)` returning new phase + nextScheduledRunAt + incremented run count per design D1.

### Acceptance criteria

- [ ] Unit tests cover all phase transitions and `lastLeadCount = 0` in BOOTSTRAP

### Do not

- Advance phase for on-demand (caller responsibility)

---

## 2.3 — Unit tests

### What to do

Spec files for both modules with table-driven cases from spec scenarios.

### Acceptance criteria

- [ ] Tests run with project test command for core lib

---

## Group verification

Run unit tests for new specs only.

## Handoff to next task

Gym-ctrl and captura import helpers from `@core/shared/...`.
