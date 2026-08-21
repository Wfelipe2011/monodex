## MODIFIED Requirements

### Requirement: Send statuses are append-only events
The system SHALL persist each Meta webhook `statuses` event as its own row with at least: outbound `wamid`, `status` (`sent`, `delivered`, `read`, `failed`), Meta timestamp, optional `recipientId`, optional error JSON for `failed`, optional link to `TenantListSend`, and optional link to `TenantLead`. Multiple status rows MAY exist for the same `wamid` over time. A city-outreach `wamid` MUST set `tenantLeadId` and MUST NOT set `listSendId` solely because of that match. A list-campaign `wamid` MUST set `listSendId` and MUST NOT set `tenantLeadId` solely because of that match.

#### Scenario: Delivered status recorded
- **WHEN** webhook posts `statuses` with `status=delivered` for `wamid` W
- **THEN** a status row for W with `delivered` MUST be inserted

#### Scenario: Failed includes errors
- **WHEN** webhook posts `status=failed` with error details
- **THEN** the status row MUST store error payload JSON

#### Scenario: City wamid links TenantLead only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantLead.messageId` and no `TenantListSend`
- **THEN** the status row MUST have `tenantLeadId` set and `listSendId` null

#### Scenario: List wamid links TenantListSend only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantListSend.wamid` and no `TenantLead.messageId`
- **THEN** the status row MUST have `listSendId` set and `tenantLeadId` null

## ADDED Requirements

### Requirement: City outreach lastStatus follows webhook statuses
When a statuses event `wamid` matches a `TenantLead.messageId`, the system MUST update that `TenantLead.lastStatus` to the mapped delivery status (`sent`, `delivered`, `read`, `failed`). Unknown Meta status strings MUST be skipped without changing `lastStatus`. City `failed` MUST NOT clear a list-campaign send lock.

#### Scenario: Delivered updates city lastStatus
- **WHEN** webhook posts `status=delivered` for a city outreach `wamid`
- **THEN** that `TenantLead.lastStatus` MUST become `delivered`

#### Scenario: City failed does not unlock list leads
- **WHEN** a city outreach `wamid` receives `status=failed` and a list lead is locked by a campaign
- **THEN** that list lead lock MUST remain unchanged
