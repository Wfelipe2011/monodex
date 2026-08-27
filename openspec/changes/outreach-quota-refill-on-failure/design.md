## Context

City outreach (`apps/notifly/src/leads.service.ts` → `contactLeads`) and list campaigns (`apps/notifly/src/list-campaigns.service.ts` → `runCampaign`) today:

1. Cap batch size with `min(leadsPerRun|sendsPerRun, affordable, eligible)`.
2. Pre-select a fixed batch.
3. Loop Graph POSTs; on error, log and continue—no replacement.
4. Coin debit/refund happens later via `webhook-persistence.service` → `coinDebitOnStatus` (`failed` refunds / city reopens `contacted=false`).

There is no notion of a send **execution**. Operators configure “5 per run” but get fewer charged sends when Graph or delivery fails.

Stakeholders: tenants (quota fulfillment), platform (predictable attempt caps / no runaway loops).

## Goals / Non-Goals

**Goals:**

- Persist a **send run** per city cron tick and per list-campaign cron tick.
- Treat `leadsPerRun` / `sendsPerRun` as the **target of charged sends** for that run.
- Refill with exactly **one** new lead per failure event (Graph fail in-process, or webhook `failed` for a run-linked send).
- Cap Graph accepts at `targetCount * 3`; close runs on success, cap, exhaustion, or **1h TTL**.
- Premium-aware city refill; never reuse the failed phone in the same city run.
- Respect `sendIntervalSeconds` between Graph POSTs including refills.

**Non-Goals:**

- On-demand sends.
- Public REST API for run history.
- Waiting on webhook to count “success” before the initial batch continues (initial batch still fires up to target Graph accepts eagerly; charged catch-up is via later refill on `failed`).
- Changing coin trigger semantics (`sent` / `delivered` / `read`).

## Decisions

### D1 — Single polymorphic run table

**Decision:** One model `OutreachSendRun` (name TBD in Prisma) with:

| Field | Notes |
|-------|--------|
| `id` | PK |
| `channel` | `CITY` \| `LIST` |
| `tenantId` | always |
| `campaignId` | nullable; set for LIST |
| `targetCount` | snapshot of `leadsPerRun` / `sendsPerRun` at open |
| `attemptCount` | incremented on each Graph HTTP 200 that creates a send row linked to the run |
| `chargedCount` | incremented when debit applies to a run-linked send |
| `status` | `OPEN` \| `CLOSED` |
| `closedReason` | nullable enum: `TARGET_MET` \| `ATTEMPT_CAP` \| `EXHAUSTED` \| `TTL` \| `SUPERSEDED` |
| `expiresAt` | `createdAt + 1h` |
| `createdAt` / `updatedAt` | |

`TenantLead.runId` and `TenantListSend.runId` nullable FKs (legacy rows null → no refill).

**Why not two tables?** Shared refill/TTL/cap logic; channel discriminant is enough.

**Alternative considered:** No table—infer “run” from time window. Rejected: races, no attempt cap, webhook cannot know membership reliably.

### D2 — Eager initial batch, async catch-up on `failed`

**Decision:** Cron still attempts up to `min(target, affordable, pool)` Graph accepts immediately (creating the run first). Charged shortfall is recovered when:

1. **Graph fail** during send/refill → after `sendIntervalSeconds`, try one replacement (same run).
2. **Webhook `failed`** on a run-linked send → after existing billing/reopen, try one replacement (same run).

Each failure event triggers **at most one** refill attempt (no “compute deficit and fan-out N”). Two failures → two events → two refills.

**Why:** Matches product decision; avoids blocking cron on Meta delivery webhooks.

**Implication:** While sends are pending (accepted, not yet failed/charged), `chargedCount` may lag `attemptCount`. That is OK—refill only on failure, not on “still pending”.

### D3 — Attempt cap = `targetCount * 3`

**Decision:** `attemptCount` counts Graph accepts (wamid persisted). Refill MUST NOT POST if `attemptCount >= targetCount * 3` or run is not `OPEN`. Graph failures that never accept do **not** increment `attemptCount`, but each Graph-fail still consumes a refill *opportunity*; to bound infinite Graph-fail loops, also track `graphFailCount` OR treat each refill *attempt* (POST try) toward a separate `tryCount` capped at `target * 3`.

**Clarification for implementers:** Cap **Graph POST attempts** (successful or not) at `targetCount * 3` via `tryCount`, and separately require `attemptCount` (accepts) never to exceed the same cap. Practical rule:

- Before any POST (initial or refill): if `tryCount >= targetCount * 3` OR run closed OR `chargedCount >= targetCount` → stop.
- On POST start: `tryCount++`.
- On Graph 200: `attemptCount++`, link send to run.
- On debit: `chargedCount++`; if `chargedCount >= targetCount` → close `TARGET_MET`.

This matches “até 15 envios” as 15 tries for target 5.

### D4 — Webhook path: one failed → one refill

**Decision:** After `handleStatus` finishes status append, `lastStatus=failed`, unlock/reopen, and coin refund, if the matched `TenantLead`/`TenantListSend` has `runId` and that run is refill-eligible, call `OutreachQuotaRefillService.refillOne({ runId, failedPhone, wasPremium })`.

Do **not** batch-refill. Concurrent webhooks for the same run each call `refillOne`; eligibility is re-checked under a row lock on the run (`SELECT … FOR UPDATE` / Prisma interactive transaction) so two parallel failures can both proceed if `tryCount` allows two more tries—exactly one lead each.

**On-demand:** ignore (no `runId`).

### D5 — Graph-fail refill with interval

**Decision:** In the send loop, on catch / binding skip that did not create a send: sleep `sendIntervalSeconds`, then `refillOne` once (same as webhook), then continue the original loop only for remaining preselected slots **or** switch to “while charged/try under caps” style.

**Preferred loop shape for city/list cron:**

```
open run (target, expiresAt=now+1h)
while tryCount < target*3
      and chargedCount < target   # charged may be 0 during tick
      and run OPEN
      and can afford 1
      and pickNextLead() != null:
  sleep interval if not first try
  try Graph
  on 200: persist + attemptCount++
  on fail: continue (tryCount already incremented)
close if exhausted mid-loop; else leave OPEN for webhook catch-up
```

Note: during the cron tick, `chargedCount` almost always stays 0 (debit is async). So the stop condition for the **initial** phase cannot wait on `chargedCount`. Use instead:

**Initial phase stop:** `graphAcceptsThisTick >= target` OR try cap OR no lead/balance.  
**Leave run OPEN** for webhook refills until charged/TTL/cap/exhaustion.

Webhook refill stop: `chargedCount >= target` OR try cap OR closed/expired OR no lead/balance.

This reconciles “target = charged” with eager Graph batching.

### D6 — Concurrent open runs

**Decision:** Before opening a city run for tenant T, close any city `OPEN` run for T with `expiresAt < now()` as `TTL`. If an non-expired `OPEN` city run exists, **do not** open a second—either skip the tick (log) or treat as `SUPERSEDED` only when product prefers new schedule slot. **Default:** skip creating a new run and skip new initial batch if an open non-expired city run exists (let refill finish). Same for list: unique open run per `campaignId`.

### D7 — Premium replacement (city only)

**Decision:** When selecting a refill lead after a failed city send that was premium (`isPremium` at send time—snapshot `wasPremium` on the send or recompute from lead + averages), prefer premium pool; if empty, fall back to regular. Non-premium failure → normal stratified single-pick (or regular-first) consistent with mix helper `computeY` for `X=1`.

List campaigns: no premium mix; any eligible unlocked list lead except the failed `listLeadId` for this run’s excluded set.

### D8 — Phone exclusion within a run

**Decision:** Maintain run-scoped excluded phones = all phones already Graph-accepted in the run **plus** the phone that just failed (even though city `failed` reopens globally). Refill MUST NOT select those phones. Across runs, existing `failed`-reopen rules remain.

### D9 — Interval on webhook refill

**Decision:** Before Graph POST from webhook-triggered refill, sleep `sendIntervalSeconds` (from tenant outreach config or campaign). Acceptable to block the webhook handler briefly for small intervals (default 5s); if interval is large, prefer fire-and-forget via `setImmediate`/`queueMicrotask` + sleep inside async without blocking Meta retries—**implement as async void with internal sleep**, errors logged, never throw to Meta webhook response path.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Webhook handler latency from sleep | Async detach refill; never fail Meta ACK |
| Double refill from duplicate `failed` webhooks | Idempotent: only first transition to `failed` triggers refill (e.g. flag `refillTriggeredAt` on send row, or only when previous `lastStatus !== failed`) |
| Run stuck OPEN forever | TTL 1h closer (lazy on next cron + on refill check) |
| Cron overlap with open run | Skip new batch while open run exists |
| Graph fail loops without accept | `tryCount` cap |
| Premium pool empty on premium fail | Fallback to regular; log |
| Balance race across channels | Reuse `computeAvailableBalance` / `affordableFromAvailable` before each refill POST |

## Migration Plan

1. Add enum/table/FKs via Prisma migration (nullable `runId` → no backfill required).
2. Deploy notifly with run+refill logic.
3. Old in-flight sends without `runId` keep current failed behavior only.
4. Rollback: deploy previous notifly; orphan runs harmlessly `OPEN` until TTL closer job or manual close—safe.

## Open Questions

None blocking—product decisions captured in explore. Implementers may choose Prisma model name (`OutreachSendRun` vs `TenantSendRun`) as long as specs semantics hold.
