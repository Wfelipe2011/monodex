## ADDED Requirements

### Requirement: Coin debit trigger is configurable per tenant
The system SHALL persist a per-tenant coin debit trigger `coinDebitOnStatus` with allowed values `sent`, `delivered`, and `read`. When unset or missing config, the effective trigger MUST be `delivered`. Only platform Super Admin MAY write this field. `failed` MUST NOT be a valid trigger value.

#### Scenario: Default is delivered
- **WHEN** a tenant has no explicit `coinDebitOnStatus` (or no outreach config row)
- **THEN** outbound city and list sends MUST use effective trigger `delivered`

#### Scenario: Super Admin sets sent
- **WHEN** Super Admin patches `coinDebitOnStatus` to `sent` for tenant T
- **THEN** subsequent billable status handling for T MUST debit on `sent` (or a later success status)

#### Scenario: Invalid trigger rejected
- **WHEN** a client writes `coinDebitOnStatus` to `failed` or an unknown value
- **THEN** the write MUST be rejected

### Requirement: Graph acceptance does not debit coins
When Cloud API accepts an outbound template send (HTTP 200 with `wamid`) for city outreach or a list campaign, the system MUST create/update the send/funnel row and MUST NOT decrement coin balance and MUST NOT create a `DEBITO` for that send at that moment.

#### Scenario: City Graph 200 without debit
- **WHEN** city outreach obtains Graph 200 for a lead
- **THEN** `TenantLead` is persisted with `messageId` and `coinDebitedAt` remains null and coin balance is unchanged

#### Scenario: List Graph 200 without debit
- **WHEN** a list campaign obtains Graph 200 for a list lead
- **THEN** `TenantListSend` is persisted and `coinDebitedAt` remains null and coin balance is unchanged

### Requirement: Debit when webhook status meets the tenant trigger
When a Meta status webhook is persisted for an outbound `wamid` tied to a city `TenantLead` or list `TenantListSend`, and the status is a success status whose rank is greater than or equal to the tenant's effective trigger (`sent` < `delivered` < `read`), and `coinDebitedAt` is null, the system MUST debit the configured cost (`costPerLead` or list `costPerSend`), create a `DEBITO` `CoinTransaction`, and set `coinDebitedAt`.

#### Scenario: Delivered debits under default trigger
- **WHEN** effective trigger is `delivered` and status `delivered` arrives for an uncharged send
- **THEN** balance decreases by the send cost and `coinDebitedAt` is set

#### Scenario: Read satisfies delivered trigger
- **WHEN** effective trigger is `delivered` and status `read` arrives for an uncharged send without a prior `delivered` debit
- **THEN** the system MUST debit once and set `coinDebitedAt`

#### Scenario: Sent does not debit under delivered trigger
- **WHEN** effective trigger is `delivered` and status `sent` arrives for an uncharged send
- **THEN** coin balance MUST NOT change

#### Scenario: Idempotent debit
- **WHEN** a second billable status arrives for a send with `coinDebitedAt` already set
- **THEN** the system MUST NOT debit again

### Requirement: Failed never leaves a net charge
When status `failed` is recorded for an outbound send, the system MUST NOT debit. If `coinDebitedAt` is set and `coinRefundedAt` is null, the system MUST credit the same cost amount, create a `CREDITO` transaction, and set `coinRefundedAt`. If the send was never debited, balance MUST stay unchanged.

#### Scenario: Failed before debit
- **WHEN** `failed` arrives and `coinDebitedAt` is null
- **THEN** no debit and no credit occur

#### Scenario: Failed after sent-trigger debit
- **WHEN** trigger is `sent`, debit already occurred, then `failed` arrives
- **THEN** a matching credit is applied once and `coinRefundedAt` is set

#### Scenario: Failed refund idempotent
- **WHEN** `failed` is delivered again for a send with `coinRefundedAt` set
- **THEN** the system MUST NOT credit again

### Requirement: Schedulers reserve balance for pending uncharged sends
City and list send schedulers MUST compute affordable sends using available balance equal to `balance - (pendingUnchargedCount * unitCost)`, where pending uncharged sends are outbound accepts for that billing scope with `coinDebitedAt` null and `lastStatus` not equal to `failed`.

#### Scenario: Pending reduces affordable batch
- **WHEN** balance covers 3 units but 2 pending uncharged sends exist at the same unit cost
- **THEN** the scheduler MUST treat affordable count as at most 1

### Requirement: City failed reopens the phone for that tenant
When a city outreach `TenantLead` receives status `failed`, the system MUST set `contacted` to false and MUST ensure subsequent city outreach selection for that tenant MAY select the same lead phone again (failed rows MUST NOT exclude the phone). List unlock behavior for `TenantListLead.sendLockCampaignId` remains required on list `failed`.

#### Scenario: Failed city phone selectable again
- **WHEN** tenant T has a `TenantLead` with `lastStatus=failed` for phone P
- **THEN** city outreach selection for T MUST NOT treat P as an excluded used phone solely because of that failed row

#### Scenario: Pending city phone still excluded
- **WHEN** tenant T has a `TenantLead` with `messageId` set and `lastStatus` null or a non-failed status
- **THEN** phone P MUST remain excluded from new city outreach for T

### Requirement: Retroactive backfill reconciles legacy debits
The system SHALL provide a one-shot backfill that: (1) refunds legacy debits for sends whose latest status is `failed`; (2) when effective trigger is `delivered` or `read`, refunds legacy debits for sends still at null/`sent` without a later billable status; (3) stamps `coinDebitedAt` on already-correct delivered/read sends without creating duplicate debits; (4) applies city reopen (`contacted=false`) for failed city leads. The backfill MUST be idempotent when re-run.

#### Scenario: Backfill refunds failed legacy debit
- **WHEN** backfill runs for a failed send that was debited under the Graph-200 model and not yet refunded
- **THEN** a credit is recorded and `coinRefundedAt` is set

#### Scenario: Backfill re-run is safe
- **WHEN** backfill runs a second time on the same rows
- **THEN** no additional credit or debit is created for those rows
