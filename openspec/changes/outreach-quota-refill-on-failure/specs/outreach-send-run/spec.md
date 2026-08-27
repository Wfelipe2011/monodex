## ADDED Requirements

### Requirement: Send runs are persisted for city and list channels
The system SHALL persist an `OutreachSendRun` (or equivalent) row when a city outreach cron tick or a list-campaign cron tick begins sending. Each run MUST store at least: `channel` (`CITY` or `LIST`), `tenantId`, optional `campaignId` (required when `LIST`), `targetCount` (snapshot of `leadsPerRun` or `sendsPerRun`), `tryCount`, `attemptCount`, `chargedCount`, `status` (`OPEN` or `CLOSED`), optional `closedReason`, `expiresAt` (`createdAt + 1 hour`), and timestamps. On-demand sends MUST NOT create or join send runs.

#### Scenario: City tick opens a city run
- **WHEN** city outreach starts a scheduled send tick for tenant T with `leadsPerRun` 5
- **THEN** an `OPEN` city run MUST exist for T with `targetCount` 5 and `expiresAt` approximately one hour after creation

#### Scenario: List tick opens a list run
- **WHEN** list campaign C starts a scheduled send tick with `sendsPerRun` 5
- **THEN** an `OPEN` list run MUST exist with `campaignId` C and `targetCount` 5

#### Scenario: On-demand has no run
- **WHEN** an on-demand template send is accepted by Graph
- **THEN** the resulting `TenantOnDemandSend` MUST NOT reference a send run

### Requirement: Graph-accepted sends link to the open run
When city or list outreach obtains Graph HTTP 200 with a `wamid` during an open run, the system MUST persist the send row (`TenantLead` or `TenantListSend`) with that run's id, MUST increment `tryCount` for the attempt, and MUST increment `attemptCount` on accept. Sends created outside a run (legacy or non-run paths) MAY leave `runId` null.

#### Scenario: City accept links run
- **WHEN** city outreach Graph-accepts a lead during run R
- **THEN** the `TenantLead` MUST have `runId` R and R's `attemptCount` MUST increase by 1

#### Scenario: List accept links run
- **WHEN** a list campaign Graph-accepts a list lead during run R
- **THEN** the `TenantListSend` MUST have `runId` R and R's `attemptCount` MUST increase by 1

### Requirement: Charged count tracks billable debits on the run
When coin debit succeeds for a city or list send that has a non-null `runId`, the system MUST increment that run's `chargedCount` by 1. If `chargedCount` reaches `targetCount`, the run MUST be closed with reason `TARGET_MET`. Failed status MUST NOT increment `chargedCount`. Refunds MUST NOT decrement `chargedCount` below the semantics needed for quota (a failed-after-debit send does not count as a lasting charge toward the target; implementers MUST ensure a send that ends in `failed` does not leave a permanent +1 on `chargedCount`—either increment only while net-charged, or decrement on refund).

#### Scenario: Debit increments charged
- **WHEN** a run-linked send is debited under the tenant trigger
- **THEN** that run's `chargedCount` MUST increase by 1

#### Scenario: Target met closes run
- **WHEN** `chargedCount` becomes equal to `targetCount`
- **THEN** the run status MUST be `CLOSED` with reason `TARGET_MET`

#### Scenario: Failed after debit does not keep quota credit
- **WHEN** a run-linked send was debited then receives `failed` with refund
- **THEN** that send MUST NOT continue to count toward satisfying `targetCount`

### Requirement: Try cap is three times the target
Before starting a Graph POST for an initial or refill send on run R, the system MUST refuse the POST when `tryCount >= targetCount * 3` or when R is not `OPEN` or when R is expired. Each Graph POST attempt (success or failure) MUST increment `tryCount`. When the try cap is hit, the run MUST be closed with reason `ATTEMPT_CAP` if still open.

#### Scenario: Cap for target five
- **WHEN** a run has `targetCount` 5
- **THEN** at most 15 Graph POST attempts MUST be made for that run

#### Scenario: Cap closes run
- **WHEN** the 15th try completes for `targetCount` 5 and `chargedCount` is still below 5
- **THEN** the run MUST be closed with reason `ATTEMPT_CAP`

### Requirement: One failure event triggers exactly one refill attempt
When a Graph POST fails without accepting a `wamid` during an open eligible run, or when Meta status `failed` is first recorded for a run-linked city/list send, the system MUST attempt exactly one replacement send for that same run (subject to eligibility). Two distinct failure events MUST produce two distinct refill attempts. Duplicate `failed` webhooks for the same send MUST NOT trigger a second refill. On-demand and sends with null `runId` MUST follow existing failed handling only (no refill).

#### Scenario: Webhook failed refills once
- **WHEN** an open run-linked city send first receives status `failed` and the run is refill-eligible
- **THEN** the system MUST attempt exactly one new city Graph send for that run

#### Scenario: Two failures two refills
- **WHEN** two different run-linked sends receive `failed` while the run remains eligible
- **THEN** the system MUST attempt exactly two refill sends (one per event)

#### Scenario: Duplicate failed is idempotent
- **WHEN** Meta redelivers `failed` for a send that already triggered refill
- **THEN** the system MUST NOT start another refill for that send

#### Scenario: Orphan failed has no refill
- **WHEN** a city or list send with null `runId` receives `failed`
- **THEN** existing refund/reopen behavior MUST run and no quota refill MUST occur

### Requirement: Refill eligibility and best-effort stop
A refill MUST proceed only when the run is `OPEN`, `expiresAt` is in the future, `tryCount < targetCount * 3`, `chargedCount < targetCount` (after applying failed-debit accounting), available balance covers one send, and at least one eligible replacement lead exists. Otherwise the system MUST skip refill; if no candidates or balance remain and the run cannot progress, it MUST close with reason `EXHAUSTED` when appropriate. Best effort is acceptable when the pool cannot fill the target.

#### Scenario: Exhausted pool stops
- **WHEN** a failure occurs on an open run but no eligible replacement lead remains
- **THEN** no Graph POST MUST be made and the run MAY be closed as `EXHAUSTED`

#### Scenario: Insufficient balance skips refill
- **WHEN** available balance cannot cover one more send
- **THEN** refill MUST NOT POST

### Requirement: Send interval applies to refills
The system MUST wait `sendIntervalSeconds` (city outreach config or list campaign) between consecutive Graph POSTs for the same run, including between a failed attempt and its refill and between webhook-triggered refill POSTs.

#### Scenario: Interval before webhook refill
- **WHEN** a refill is triggered from a `failed` webhook and `sendIntervalSeconds` is 5
- **THEN** at least 5 seconds MUST elapse after the prior POST for that run before the refill Graph request

### Requirement: City refill excludes phones already used or just failed in the run
For city channel refills, the system MUST NOT select a phone that already has a Graph-accepted send in the same run, and MUST NOT select the phone of the send/attempt that triggered the refill—even though globally a `failed` city phone is reopenable for later runs.

#### Scenario: Failed phone not reused in same run
- **WHEN** city run R fails for phone P and a refill runs
- **THEN** the refill candidate MUST NOT use phone P

### Requirement: List refill excludes the failed list lead for that attempt
For list channel refills, the system MUST pick a different eligible unlocked list lead than the one whose send just failed (when selecting due to that failure), subject to normal lock and campaign rules.

#### Scenario: Different list lead on refill
- **WHEN** list run R fails for list lead L and refill is eligible
- **THEN** the refill MUST target a list lead other than L when another eligible lead exists

### Requirement: TTL closes open runs after one hour
The system MUST treat a run as expired when `now >= expiresAt`. Expired open runs MUST be closed with reason `TTL` (lazily on cron/refill checks is sufficient). Refill MUST NOT run against an expired run.

#### Scenario: Hour-old run no refill
- **WHEN** an otherwise eligible `failed` arrives for a run whose `expiresAt` is in the past
- **THEN** the run MUST be closed as `TTL` if still open and no refill Graph POST MUST occur

### Requirement: At most one non-expired open run per city tenant or list campaign
While a non-expired `OPEN` city run exists for tenant T, a new city cron tick MUST NOT open another city run or start a new initial batch for T. While a non-expired `OPEN` list run exists for campaign C, a new campaign tick MUST NOT open another run for C.

#### Scenario: Skip city tick while run open
- **WHEN** tenant T has an `OPEN` city run not yet expired and the city cron fires again
- **THEN** the scheduler MUST NOT create a second open city run for T
