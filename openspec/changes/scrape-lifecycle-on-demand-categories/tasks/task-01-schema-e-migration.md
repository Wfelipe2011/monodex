# Task 1 — Schema e migration

**Change:** `scrape-lifecycle-on-demand-categories`
**Group:** 1 of 7
**Prerequisites:** none
**Unlocks:** [task-02-shared-categorias-e-lifecycle.md](./task-02-shared-categorias-e-lifecycle.md), [task-03-captura-lifecycle-planned.md](./task-03-captura-lifecycle-planned.md), [task-04-captura-on-demand-cursor.md](./task-04-captura-on-demand-cursor.md)

## Group objective

Persist lifecycle fields, on-demand state/runs, and backfill existing coverage so captura can select eligible targets without a daily full scan.

## Context for the subagent

- Schema: `prisma/schema.prisma` — models `ScrapeTarget`, `ScrapeCoverage` (~lines 475–501).
- Coverage today: `firstRunAt`, `lastRunAt`, `lastStatus`, `lastLeadCount` only.
- Use snake_case `@map` on columns; enums in Prisma for `schedulePhase` and `lastRunKind`.
- Do not change `Lead` identity or outreach tables in this group.

## Expected files on completion

| File | Action |
|------|--------|
| `prisma/schema.prisma` | edit |
| `prisma/migrations/*` | create |
| Optional SQL backfill in migration or standalone script documented in migration comment | create |

---

## 1.1 — Estender ScrapeCoverage

### What to do

Add enum `ScrapeSchedulePhase` with values `BOOTSTRAP`, `COOLDOWN_90D`, `RECURRING_180D`.

Add to `ScrapeCoverage`:

- `schedulePhase ScrapeSchedulePhase @default(BOOTSTRAP) @map("schedule_phase")`
- `nextScheduledRunAt DateTime? @map("next_scheduled_run_at")`
- `scheduledRunCount Int @default(0) @map("scheduled_run_count")`
- `lastRunKind String? @map("last_run_kind")` — store `planned` or `on_demand` (or small enum)

### Acceptance criteria

- [ ] Unique `(cityId, category)` unchanged
- [ ] New rows default to `BOOTSTRAP` with null `nextScheduledRunAt`

### Do not

- Remove or rename existing coverage columns

---

## 1.2 — Tabelas on-demand

### What to do

Add `ScrapeOnDemandState`:

- `id`, `tenantId`, `scrapeTargetId` (FKs), `onDemandEnabled Boolean @default(true)`, `bairroOrder Json` (array of strings), `nextBairroIndex Int @default(0)`, timestamps
- `@@unique([tenantId, scrapeTargetId])`, `@@map("scrape_on_demand_states")`

Add `ScrapeOnDemandRun`:

- `id`, `tenantId`, `scrapeTargetId`, `startedAt`, `finishedAt?`, `status` (string or enum: `running|success|failed|conflict`), `leadsTouched Int @default(0)`, `bairrosProcessed Int @default(0)`
- Index on `(tenantId, scrapeTargetId, startedAt)` for quota queries
- `@@map("scrape_on_demand_runs")`

Optional on `ScrapeTarget`: `onDemandAllowed Boolean @default(true) @map("on_demand_allowed")` for platform kill-switch.

### Acceptance criteria

- [ ] FK to `Tenant` and `ScrapeTarget` with sensible `onDelete` (Restrict on target)

### Do not

- Add coin billing columns

---

## 1.3 — Backfill migration

### What to do

For each existing `scrape_coverages` row:

- If `last_lead_count >= 1`: set `schedule_phase = COOLDOWN_90D`, `next_scheduled_run_at = GREATEST(last_run_at + interval '90 days', now()) + (random 0–7 days jitter per row id)` to avoid thundering herd
- Else: `BOOTSTRAP`, null next run

If no coverage row but enabled target exists: leave to runtime (captura treats missing coverage as BOOTSTRAP on first planned run).

### Acceptance criteria

- [ ] Migration applies cleanly on empty and populated DB
- [ ] No enabled target forced disabled

### Do not

- Backfill on-demand state rows (create lazily on first POST)

---

## 1.4 — Validate Prisma

### What to do

Run `npx prisma validate` and generate client.

### Acceptance criteria

- [ ] `npx prisma validate` exits 0

---

## Group verification

- `npx prisma validate`
- Inspect migration SQL for backfill logic

## Handoff to next task

Prisma client exposes new fields; captura and gym-ctrl can import enums from `@prisma/client`.
