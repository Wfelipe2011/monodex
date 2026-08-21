## MODIFIED Requirements

### Requirement: Campaign send debits list cost per send
When a list campaign outbound send reaches the tenant's effective `coinDebitOnStatus` (per `coin-debit-on-status`), the system MUST decrement the tenant coin balance by that list's `costPerSend` and record a `CoinTransaction` of type `DEBITO`. Graph HTTP 200 with `wamid` alone MUST NOT debit. The system MUST NOT apply cashback on reply for list campaigns. The cron MUST skip the tenant when `Tenant.active` is false or `costPerSend` is less than or equal to 0.

#### Scenario: Status trigger debits coins
- **WHEN** a list send's Meta status meets the tenant trigger and the send is uncharged
- **THEN** balance decreases by `costPerSend` and a debit transaction is recorded

#### Scenario: Graph acceptance alone does not debit
- **WHEN** a campaign send completes with Graph acceptance and no billable status has been applied
- **THEN** coin balance MUST remain unchanged for that send

#### Scenario: Insufficient available balance skips send
- **WHEN** tenant available balance (raw balance minus pending uncharged reservations for that list's unit cost) is less than `costPerSend`
- **THEN** the cron MUST NOT attempt sends for that list's campaigns

#### Scenario: Zero cost skips send
- **WHEN** the list `costPerSend` is 0
- **THEN** the cron MUST NOT attempt sends for that list's campaigns

### Requirement: Lead locks after successful send until delivery failure
After a campaign obtains Graph HTTP 200 for a list lead, that lead MUST be unavailable for sends from other campaigns on the same list. If a webhook status `failed` is recorded for that outbound `wamid`, the lead MUST become eligible again for other campaigns and any coin debit for that send MUST be refunded per `coin-debit-on-status`. While locked with non-failed status, other campaigns MUST NOT select that lead.

#### Scenario: Second campaign skips locked lead
- **WHEN** lead X received a successful send from campaign A and no `failed` status exists
- **THEN** campaign B MUST NOT send to lead X

#### Scenario: Failed status unlocks lead
- **WHEN** outbound `wamid` for lead X receives status `failed`
- **THEN** lead X MUST be eligible for other campaigns

#### Scenario: Failed refunds prior debit
- **WHEN** outbound `wamid` was debited under trigger `sent` and later receives `failed`
- **THEN** the tenant MUST receive a matching credit once

### Requirement: Batch size respects sendsPerRun and balance
Each cron tick for a campaign SHALL send at most `sendsPerRun` list leads, further capped by `floor(availableBalance / costPerSend)` (available = balance minus pending uncharged sends for that list × `costPerSend`) and eligible unlocked leads. Sends MUST be spaced by `sendIntervalSeconds` between Cloud API requests for that campaign run.

#### Scenario: Balance caps batch
- **WHEN** available balance covers 2 sends and `sendsPerRun` is 5
- **THEN** at most 2 leads are sent in that tick

#### Scenario: Pending reservation reduces batch
- **WHEN** raw balance covers 3 sends but 1 pending uncharged send exists on the list
- **THEN** at most 2 new sends are attempted in that tick
