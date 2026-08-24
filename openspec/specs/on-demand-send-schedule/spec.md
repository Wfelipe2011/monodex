# on-demand-send-schedule Specification

## Purpose

Tenant Admin (JWT or API key) schedules one granted template to one recipient at a date and hour in `America/Sao_Paulo`; pending rows are cancellable and the hourly worker sends or fails without debiting coins.

## Requirements

### Requirement: Tenant can schedule one template to one recipient at a date and hour
The system SHALL allow tenant `ADMIN` (JWT or API key) to create a one-shot schedule under `/tenant/:tenantId/on-demand-schedules` with exactly one `templateId`, one destination `to`, one `scheduledFor` (calendar date and hour in `America/Sao_Paulo`), and the same slot payload as immediate send (`variables`, optional `imageId`, optional `leadId`). Super Admin MUST NOT create schedules (HTTP 403). A `scheduledFor` in the past MUST be rejected with HTTP 400. Minute-level precision MUST NOT be required; the stored instant MUST be the start of that hour in `America/Sao_Paulo`.

#### Scenario: Create pending schedule
- **WHEN** `ADMIN` posts a future date and hour with a granted template and valid slots snapshot
- **THEN** a row is persisted with status `PENDING` and HTTP 201 returns the schedule id and `scheduledFor`

#### Scenario: Past hour rejected
- **WHEN** `scheduledFor` is before the current hour in `America/Sao_Paulo`
- **THEN** the API responds with HTTP 400 and MUST NOT persist the schedule

#### Scenario: Super Admin cannot create
- **WHEN** `SUPER_ADMIN` POSTs a schedule
- **THEN** the API responds with HTTP 403

#### Scenario: API key can create
- **WHEN** a valid API key POSTs a future schedule for its tenant
- **THEN** the schedule is persisted as `PENDING`

### Requirement: Pending schedules are cancellable
The system SHALL allow tenant `ADMIN` (JWT or API key) to cancel a `PENDING` schedule. Super Admin MUST NOT cancel (HTTP 403). Cancel of a non-pending schedule MUST be rejected. After cancel, the worker MUST NOT send.

#### Scenario: Cancel pending
- **WHEN** `ADMIN` cancels a `PENDING` schedule
- **THEN** status becomes `CANCELLED` and the worker MUST NOT call Graph for it

#### Scenario: Cancel sent rejected
- **WHEN** the schedule status is already `SENT` and `ADMIN` cancels
- **THEN** the API responds with HTTP 400 or 409 and status remains `SENT`

### Requirement: Hourly worker fires due pending schedules
The system SHALL persist `PlatformJobKey` `ON_DEMAND_SCHEDULE_RUN` with default cron `0 * * * *` and timezone `America/Sao_Paulo`, executed by notifly. Each tick MUST claim `PENDING` schedules whose `scheduledFor` is less than or equal to now. A successful Graph accept MUST persist `TenantOnDemandSend` with `source=SCHEDULE`, set schedule status `SENT`, and MUST NOT debit coins at Graph 200.

#### Scenario: Due schedule sends
- **WHEN** a `PENDING` schedule's hour has arrived and preflight passes
- **THEN** Graph is called once, an on-demand send row exists with that `wamid`, and schedule status is `SENT`

#### Scenario: Future schedule skipped
- **WHEN** `scheduledFor` is still in a future hour
- **THEN** the worker MUST NOT send that row

### Requirement: Fire-time preflight failure does not debit
When the worker (or equivalent) cannot send because the tenant is inactive, API/template grant is missing, template is not `APPROVED`, dedicated number is missing, media is missing, `costPerOnDemandSend` ≤ 0, or available balance is insufficient, the system MUST set schedule status `FAILED` with a reason, MUST NOT call Graph, and MUST NOT debit coins.

#### Scenario: Insufficient balance at fire
- **WHEN** a due `PENDING` schedule is selected and available balance is below `costPerOnDemandSend`
- **THEN** status is `FAILED`, Graph is not called, and coin balance is unchanged

#### Scenario: Template grant revoked at fire
- **WHEN** the scheduled template is no longer granted to the tenant at fire time
- **THEN** status is `FAILED` and coins are not debited

#### Scenario: Image deleted at fire
- **WHEN** the schedule referenced `imageId` and that media row no longer exists at fire time
- **THEN** status is `FAILED` and coins are not debited
