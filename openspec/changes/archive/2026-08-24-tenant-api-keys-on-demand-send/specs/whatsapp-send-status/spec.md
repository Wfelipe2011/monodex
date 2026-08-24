## MODIFIED Requirements

### Requirement: Send statuses are append-only events
The system SHALL persist each Meta webhook `statuses` event as its own row with at least: outbound `wamid`, `status` (`sent`, `delivered`, `read`, `failed`), Meta timestamp, optional `recipientId`, optional error JSON for `failed`, optional link to `TenantListSend`, optional link to `TenantLead`, and optional link to `TenantOnDemandSend`. Multiple status rows MAY exist for the same `wamid` over time. A city-outreach `wamid` MUST set `tenantLeadId` and MUST NOT set `listSendId` or `onDemandSendId` solely because of that match. A list-campaign `wamid` MUST set `listSendId` and MUST NOT set `tenantLeadId` or `onDemandSendId` solely because of that match. An on-demand `wamid` MUST set `onDemandSendId` and MUST NOT set `tenantLeadId` or `listSendId` solely because of that match.

#### Scenario: Delivered status recorded
- **WHEN** webhook posts `statuses` with `status=delivered` for `wamid` W
- **THEN** a status row for W with `delivered` MUST be inserted

#### Scenario: Failed includes errors
- **WHEN** webhook posts `status=failed` with error details
- **THEN** the status row MUST store error payload JSON

#### Scenario: City wamid links TenantLead only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantLead.messageId` and no `TenantListSend` and no `TenantOnDemandSend`
- **THEN** the status row MUST have `tenantLeadId` set and `listSendId` null and `onDemandSendId` null

#### Scenario: List wamid links TenantListSend only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantListSend.wamid` and no `TenantLead.messageId` and no `TenantOnDemandSend`
- **THEN** the status row MUST have `listSendId` set and `tenantLeadId` null and `onDemandSendId` null

#### Scenario: On-demand wamid links TenantOnDemandSend only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantOnDemandSend.wamid` and no city or list send
- **THEN** the status row MUST have `onDemandSendId` set and `tenantLeadId` null and `listSendId` null
