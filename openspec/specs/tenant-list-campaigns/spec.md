# tenant-list-campaigns Specification

## Purpose
TBD - created by archiving change tenant-list-campaigns-inbox. Update Purpose after archive.
## Requirements
### Requirement: Campaign schedules template on a list
The system SHALL persist a campaign on a lead list with at least: `name`, `enabled`, `templateId` (FK to approved catalog row), `slotBindings` for role `send`, `schedule` JSON (same weekday→hours UTC shape as tenant outreach), `sendsPerRun` (≥ 1), `sendIntervalSeconds` (≥ 0), and `buttonActions` mapping QUICK_REPLY labels to `NOTIFY` or `NOOP`. A campaign MAY optionally include `notifyTemplateId` and `notifySlotBindings` when any button action is `NOTIFY`. Multiple campaigns MAY exist on the same list.

#### Scenario: Create campaign
- **WHEN** `SUPER_ADMIN` posts a valid campaign body for list L
- **THEN** the campaign is persisted and associated with L

#### Scenario: Enable requires approved template and bindings
- **WHEN** `enabled` is true and the template is not `APPROVED` or required send slots lack bindings
- **THEN** the write MUST be rejected with HTTP 400

### Requirement: Campaign send debits list cost per send
When a list campaign successfully sends a template via Cloud API (HTTP 200 with `wamid`), the system MUST decrement the tenant coin balance by that list's `costPerSend` and record a `CoinTransaction` of type `DEBITO`. The system MUST NOT apply cashback on reply for list campaigns.

#### Scenario: Successful send debits coins
- **WHEN** a campaign send completes with Graph acceptance
- **THEN** balance decreases by `costPerSend` and a debit transaction is recorded

#### Scenario: Insufficient balance skips send
- **WHEN** tenant balance is less than `costPerSend`
- **THEN** the cron MUST NOT attempt sends for that list's campaigns

### Requirement: Lead locks after successful send until delivery failure
After a campaign obtains Graph HTTP 200 for a list lead, that lead MUST be unavailable for sends from other campaigns on the same list. If a webhook status `failed` is recorded for that outbound `wamid`, the lead MUST become eligible again for other campaigns. While locked with non-failed status, other campaigns MUST NOT select that lead.

#### Scenario: Second campaign skips locked lead
- **WHEN** lead X received a successful send from campaign A and no `failed` status exists
- **THEN** campaign B MUST NOT send to lead X

#### Scenario: Failed status unlocks lead
- **WHEN** outbound `wamid` for lead X receives status `failed`
- **THEN** lead X MUST be eligible for other campaigns

### Requirement: Batch size respects sendsPerRun and balance
Each cron tick for a campaign SHALL send at most `sendsPerRun` list leads, further capped by `floor(coin balance / costPerSend)` and eligible unlocked leads. Sends MUST be spaced by `sendIntervalSeconds` between Cloud API requests for that campaign run.

#### Scenario: Balance caps batch
- **WHEN** `sendsPerRun` is 10 and balance covers only 3 sends
- **THEN** at most 3 sends MUST be attempted

### Requirement: Button actions drive notify or noop
When an inbound webhook message has `type=button` and `context.id` matches a list campaign outbound `wamid`, the system MUST look up the configured action for that button label. `NOTIFY` MUST send the campaign's notify template to the tenant's phone using notify bindings and `recipient.*` / `tenant.phone` / literals. `NOOP` MUST persist the message only. Inbound text messages without a mapped button MUST NOT trigger notify.

#### Scenario: Notify on mapped button
- **WHEN** lead taps QUICK_REPLY whose label is configured as `NOTIFY`
- **THEN** the notify template is sent to `Tenant.phone` via platform Cloud API

#### Scenario: Noop button
- **WHEN** lead taps QUICK_REPLY configured as `NOOP`
- **THEN** no notify template is sent

#### Scenario: Free text does not notify
- **WHEN** lead sends a text reply without button type
- **THEN** the message is stored and notify MUST NOT run

### Requirement: List campaign cron is separate from city outreach
The system SHALL execute list campaigns in notifly via a dedicated scheduler that MUST NOT select global `Lead` rows or create `TenantLead` rows. City outreach `contactLeads` behavior MUST remain unchanged.

#### Scenario: City outreach unaffected
- **WHEN** list campaign cron runs
- **THEN** global lead pool selection for tenant outreach MUST NOT be modified

