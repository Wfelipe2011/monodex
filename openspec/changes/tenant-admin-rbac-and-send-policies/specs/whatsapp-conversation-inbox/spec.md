## MODIFIED Requirements

### Requirement: Super admin can read conversation history
The system SHALL allow tenant `ADMIN` to list conversation messages for a list lead via `GET /tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages` with optional `since` ISO timestamp for polling. Messages MUST be ordered ascending by creation time. `SUPER_ADMIN` MUST be allowed to GET the same resource and MUST NOT be allowed to POST replies except inside the bootstrap window (reply is tenant-owned).

#### Scenario: Poll with since
- **WHEN** client calls GET with `since` set to last seen timestamp
- **THEN** only messages created after `since` MUST be returned

#### Scenario: Super admin GET allowed
- **WHEN** `SUPER_ADMIN` GETs messages for tenant 4 list lead
- **THEN** the API returns the message list (or 404 if missing), not 403 for role

### Requirement: Super admin can send free-text replies within Meta window
The system SHALL allow tenant `ADMIN` to POST `{ text }` on `/tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages` to send a Cloud API text message to the list lead's phone. The request MUST be rejected with HTTP 400 when no inbound message from that phone exists within the last 24 hours (Meta customer care window). Successful sends MUST use the platform Cloud API account and persist outbound conversation messages. After the bootstrap window, `SUPER_ADMIN` POST MUST return HTTP 403.

#### Scenario: Send within window
- **WHEN** last inbound from the lead's phone was 2 hours ago and text is non-empty and `ADMIN` of that tenant posts
- **THEN** Graph text message is sent and outbound row is created

#### Scenario: Send outside window rejected
- **WHEN** no inbound from that phone in the last 24 hours
- **THEN** API responds HTTP 400 and MUST NOT call Graph

#### Scenario: Super admin reply after bootstrap rejected
- **WHEN** `SUPER_ADMIN` POSTs a reply and no bootstrap window applies to that conversation resource
- **THEN** the API responds with HTTP 403
