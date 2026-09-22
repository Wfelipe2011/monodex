# Task 7 — Postman, FRONT-INTEGRATION e verificação

**Change:** `scrape-lifecycle-on-demand-categories`
**Group:** 7 of 7
**Prerequisites:** [task-05-gym-ctrl-on-demand-e-coverage.md](./task-05-gym-ctrl-on-demand-e-coverage.md), [task-06-gym-ctrl-outreach-categorias.md](./task-06-gym-ctrl-outreach-categorias.md)
**Unlocks:** none (final)

## Group objective

Update API contracts documentation and manual verification checklist for lifecycle, on-demand, and category restriction.

## Context for the subagent

- Postman: `postman/monodex.postman_collection.json`
- FRONT-INTEGRATION pattern: see archived changes under `openspec/changes/archive/*/FRONT-INTEGRATION.md`
- Regenerate swagger if project uses `swagger-spec.json` commit convention — check `package.json` scripts.

## Expected files on completion

| File | Action |
|------|--------|
| `postman/monodex.postman_collection.json` | edit |
| `openspec/changes/scrape-lifecycle-on-demand-categories/FRONT-INTEGRATION.md` | create |
| Optional `swagger-spec.json` | edit if repo tracks it |

---

## 7.1 — Postman

### What to do

Add folder entries:

- Tenant on-demand POST/GET/PATCH under scrape targets
- GET eligible-categories
- Note new coverage fields on platform scrape-coverages

Include example bodies and 429/409 responses.

### Acceptance criteria

- [ ] Collection imports without JSON errors

---

## 7.2 — FRONT-INTEGRATION

### What to do

Document:

- **Breaking:** tenant outreach categories must come from GET eligible-categories
- On-demand UX: show runs left today (2 max), cursor progress, disable toggle
- Do not promise immediate full pool refresh

### Acceptance criteria

- [ ] Markdown lists routes and error codes

---

## 7.3 — Checklist manual

### What to do

Write checklist in FRONT-INTEGRATION or task file:

1. Target BOOTSTRAP runs on cron until `lastLeadCount >= 1`
2. Then skipped until 90d (or manually set `nextScheduledRunAt` past for test)
3. On-demand twice same day → third 429
4. Second on-demand different bairro slice (log evidence)
5. Tenant PATCH outreach invalid category → 400
6. Business hours: only K targets in one cron tick (mock time or wait)

### Acceptance criteria

- [ ] Checklist reproducible on local stack

---

## Group verification

Import Postman; run grep for documented paths in collection.

## Handoff to next task

Change ready to archive after implementation + checklist signed off.
