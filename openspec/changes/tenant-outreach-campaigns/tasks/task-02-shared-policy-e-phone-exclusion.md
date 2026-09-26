# Task 2 — Shared — policy e phone exclusion

**Change:** `tenant-outreach-campaigns`
**Group:** 2 of 6
**Prerequisites:** [task-01](./task-01-schema-e-migration.md)
**Unlocks:** [task-03](./task-03-notifly-runs-e-contactleads-por-campanha.md), [task-04](./task-04-gym-ctrl-config-e-crud-de-campanhas.md)

## Group objective

Centralize campaign `cityId` validation against `TenantSendPolicy` and align phone exclusion with permanent pool lock (including Meta `failed`).

## Context for the subagent

- Existing: `@core/shared/send-policy` — `asIntArray`, `cityIdFilter`, `mergeExcludedPhones`.
- Phone exclusion: `apps/notifly/src/coin-reservation.ts` — `cityUsedPhonesWhere` uses `lastStatusNotFailed` (failed phones re-enter pool today). **Change to permanent lock.**
- Comments in `isCityPhoneExcludedByStatus` say failed does NOT exclude — update to match spec.

## Expected files on completion

| File | Action |
|------|--------|
| `libs/core/src/shared/send-policy.ts` or new helper file | edit/create |
| `apps/notifly/src/coin-reservation.ts` | edit |
| `libs/core/src/shared/on-demand-balance.ts` (if re-exports filters) | edit maybe |
| Unit tests alongside | edit/create |

---

## 2.1 — Helper de validação `cityId` da campanha vs `TenantSendPolicy`

### What to do

Add exported function e.g. `assertCampaignCityAllowed(cityId: number | null | undefined, policy: { allowedCityIds, deniedCityIds })` that throws or returns validation error:

- Both arrays non-empty → reject (policy invalid — existing rule)
- If `allowedCityIds.length === 1` and `cityId` is non-null and not equal → reject
- If `allowedCityIds.length > 0` and `cityId` not in list → reject
- If `deniedCityIds` contains `cityId` → reject
- Null `cityId` → ok (means all allowed by policy)

Use in gym-ctrl campaign service (task 4); export for tests.

### Acceptance criteria

- [ ] Unit tests cover single-city tenant, multi allowlist, unrestricted policy

### Do not

- Implement HTTP layer here

---

## 2.2 — Atualizar `cityUsedPhonesWhere` / comentários para lock permanente (inclui failed com `messageId`)

### What to do

Change `cityUsedPhonesWhere(tenantId)` to exclude leads where `messageId IS NOT NULL` (Graph acceptance for pool), **including** `lastStatus = failed`.

Update `isCityPhoneExcludedByStatus` documentation to reflect permanent audience lock.

Ensure `pendingUnchargedCityWhere` still uses pending status logic for coin reservation (unchanged behavior for billing).

Update `apps/notifly/src/coin-reservation.spec.ts` expectations.

### Acceptance criteria

- [ ] Test: tenant with failed city send still excludes phone in `cityUsedPhonesWhere`
- [ ] Pending uncharged sends still reserve balance

### Do not

- Change list send lock behavior

---

## Group verification

Run unit tests for coin-reservation and new send-policy tests.

## Handoff to next task

Notifly selection can import updated `cityUsedPhonesWhere`; admin validation uses city helper.
