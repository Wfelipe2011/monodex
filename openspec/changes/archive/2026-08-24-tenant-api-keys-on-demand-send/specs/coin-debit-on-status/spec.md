## MODIFIED Requirements

### Requirement: Graph acceptance does not debit coins
When Cloud API accepts an outbound template send (HTTP 200 with `wamid`) for city outreach, a list campaign, or an on-demand send, the system MUST create/update the send/funnel row and MUST NOT decrement coin balance and MUST NOT create a `DEBITO` for that send at that moment.

#### Scenario: City Graph 200 without debit
- **WHEN** city outreach obtains Graph 200 for a lead
- **THEN** `TenantLead` is persisted with `messageId` and `coinDebitedAt` remains null and coin balance is unchanged

#### Scenario: List Graph 200 without debit
- **WHEN** a list campaign obtains Graph 200 for a list lead
- **THEN** `TenantListSend` is persisted and `coinDebitedAt` remains null and coin balance is unchanged

#### Scenario: On-demand Graph 200 without debit
- **WHEN** an on-demand send obtains Graph 200
- **THEN** `TenantOnDemandSend` is persisted with `coinDebitedAt` null and coin balance is unchanged

### Requirement: Debit when webhook status meets the tenant trigger
When a Meta status webhook is persisted for an outbound `wamid` tied to a city `TenantLead`, list `TenantListSend`, or `TenantOnDemandSend`, and the status is a success status whose rank is greater than or equal to the tenant's effective trigger (`sent` < `delivered` < `read`), and `coinDebitedAt` is null, the system MUST debit the configured cost (`costPerLead`, list `costPerSend`, or `costPerOnDemandSend`), create a `DEBITO` `CoinTransaction`, and set `coinDebitedAt`.

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

#### Scenario: On-demand uses on-demand price
- **WHEN** a billable status arrives for an uncharged `TenantOnDemandSend`
- **THEN** the debit amount MUST be that tenant's `costPerOnDemandSend`

### Requirement: Schedulers reserve balance for pending uncharged sends
City, list, and on-demand send paths MUST compute available balance as `balance - pendingCity*costPerLead - pendingList*costPerSend - pendingOnDemand*costPerOnDemandSend`, where each pending count is outbound accepts for that channel with `coinDebitedAt` null and `lastStatus` not equal to `failed`. Affordable city/list batch size and on-demand preflight MUST use that available amount.

#### Scenario: Pending reduces affordable batch
- **WHEN** balance covers 3 units but 2 pending uncharged sends exist at the same unit cost
- **THEN** the scheduler MUST treat affordable count as at most 1

#### Scenario: On-demand pending reduces city affordable
- **WHEN** balance is 2.0, `costPerLead` is 1.0, `costPerOnDemandSend` is 1.0, and one on-demand send is pending uncharged with no city pending
- **THEN** city outreach MUST treat affordable city sends as at most 1
