## Why

Today each city outreach tick and each list-campaign tick picks a fixed batch of size `leadsPerRun` / `sendsPerRun` and stops after those attempts. Graph errors and Meta `failed` statuses leave the tenant short of the quota they configured for that execution—only a subset is accepted and eventually charged. Tenants expect the platform to keep filling until the run’s target of successful (charged) sends is met, within safe attempt limits.

## What Changes

- Introduce persisted **send runs** for city outreach and list campaigns (`targetCount`, attempt counters, status, TTL).
- Each Graph-accepted send in a run is linked to that run (`runId` on `TenantLead` / `TenantListSend`).
- On **Graph failure** during the initial tick (or during a refill), wait `sendIntervalSeconds` and attempt **one** replacement lead for the same run (subject to caps / pool / balance).
- On Meta webhook **`failed`** for a send that belongs to an open run, after existing refund/reopen behavior, enqueue **exactly one** replacement send for that run (one failed event → one refill attempt).
- Cap Graph accepts (attempts) per run at `targetCount * 3`. Close runs when charged quota is met, attempt cap is hit, pool/balance is exhausted, or **TTL of 1 hour** elapses.
- City refill MUST NOT reuse the failed phone within the same run; if the failed send was premium, prefer another premium replacement when available.
- **On-demand sends are out of scope.**
- No public API contract change required for operators beyond optional observability in logs; schema additions are internal.

## Capabilities

### New Capabilities

- `outreach-send-run`: Persisted execution lifecycle, attempt/charged accounting, Graph-fail and webhook-fail refill rules, TTL, and premium-aware single-lead replacement for city and list channels.

### Modified Capabilities

- `cloud-outreach-runtime`: A scheduled city tick opens a send run; initial batch targets `leadsPerRun`; Graph failures trigger same-run refill instead of silently consuming a slot.
- `tenant-list-campaigns`: A campaign tick opens a send run; `sendsPerRun` is the charged target with the same refill semantics.
- `premium-lead-mix`: Refill selection for a failed premium city send prefers another premium candidate when possible.
- `coin-debit-on-status`: Charged count for a run increments when debit applies; `failed` path remains non-charging / refunding and is the webhook hook point that may trigger refill (orchestration lives in `outreach-send-run`).

## Impact

- **Schema / Prisma**: new run table(s); nullable `runId` FKs on `TenantLead` and `TenantListSend`; migration.
- **notifly**: `leads.service` (`contactLeads`), `list-campaigns.service`, `webhook-persistence.service` / post-`failed` hook, shared refill helper; possibly a small queue/delay for Graph-retry and interval between refill POSTs.
- **Billing**: unchanged debit/refund rules; run counters read `coinDebitedAt` / attempt increments on Graph 200.
- **gym-ctrl / Postman / swagger**: no required REST surface unless we expose run diagnostics later (not in this change).
- **Out of scope**: on-demand sends, changing `leadsPerRun` defaults, UI for run history.
