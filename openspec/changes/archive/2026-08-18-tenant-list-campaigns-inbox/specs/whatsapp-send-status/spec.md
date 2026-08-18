# whatsapp-send-status Specification

## Purpose

Persist Meta delivery status events separately from conversation messages and expose failed-send visibility for list campaign outbound.

## ADDED Requirements

### Requirement: Send statuses are append-only events
The system SHALL persist each Meta webhook `statuses` event as its own row with at least: outbound `wamid`, `status` (`sent`, `delivered`, `read`, `failed`), Meta timestamp, optional `recipientId`, optional error JSON for `failed`, and optional link to `TenantListSend`. Multiple status rows MAY exist for the same `wamid` over time.

#### Scenario: Delivered status recorded
- **WHEN** webhook posts `statuses` with `status=delivered` for `wamid` W
- **THEN** a status row for W with `delivered` MUST be inserted

#### Scenario: Failed includes errors
- **WHEN** webhook posts `status=failed` with error details
- **THEN** the status row MUST store error payload JSON

### Requirement: Failed status unlocks list lead for other campaigns
When a `failed` status is recorded for a list campaign outbound `wamid`, the system MUST clear the list lead send lock so other campaigns on the same list MAY target that lead again.

#### Scenario: Unlock on failed
- **WHEN** failed status arrives for send S tied to list lead L
- **THEN** L MUST no longer be locked by S's campaign

### Requirement: Super admin can query sends and failures
The system SHALL expose list campaign sends with aggregated latest status for `SUPER_ADMIN`, filterable by `status=failed`, suitable for a front-end failed-deliveries view.

#### Scenario: Filter failed sends
- **WHEN** `SUPER_ADMIN` requests sends for list L with `status=failed`
- **THEN** only sends whose latest Meta status is `failed` MUST be returned

### Requirement: Status storage is separate from conversation inbox
Delivery status rows MUST NOT replace or duplicate conversation message content. Conversation API history MUST NOT require reading status tables.

#### Scenario: Inbox without status
- **WHEN** client fetches conversation messages for a lead
- **THEN** response MUST be satisfiable from conversation message rows alone
