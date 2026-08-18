# whatsapp-conversation-inbox Specification

## Purpose
TBD - created by archiving change tenant-list-campaigns-inbox. Update Purpose after archive.
## Requirements
### Requirement: Conversation messages are stored separately from send statuses
The system SHALL persist conversation messages in a dedicated store distinct from delivery status events. Each row MUST include at least: Meta `wamid` (unique), `direction` (`IN` | `OUT`), `type` (e.g. `text`, `button`, `image`, `audio`, `document`, `unknown`), optional normalized `body` text, raw payload JSON, normalized destination/origin `phone`, `tenantId`, and optional `listLeadId` linking to a tenant list lead. Delivery statuses MUST NOT be written into conversation message rows.

#### Scenario: Inbound webhook creates message
- **WHEN** webhook delivers an inbound `messages` event
- **THEN** a conversation message row with `direction=IN` and the Meta `wamid` MUST be created

#### Scenario: Outbound API creates message
- **WHEN** super-admin sends text via the conversation API and Graph returns `wamid`
- **THEN** a conversation message row with `direction=OUT` MUST be created with that `wamid`

### Requirement: Outbound template sends from list campaigns are recorded
When a list campaign or notify action posts a Cloud API message, the system MUST record an outbound conversation message linked to the tenant and list lead when applicable, including the returned `wamid`.

#### Scenario: Campaign template outbound stored
- **WHEN** list campaign cron successfully sends a template
- **THEN** an outbound conversation message exists with the Graph `wamid`

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

### Requirement: Basic media types are stored without full download in MVP
For inbound types other than `text` and `button`, the system MUST persist `type` and raw webhook JSON. Full media download from Meta CDN is out of scope for MVP.

#### Scenario: Inbound image stored as raw
- **WHEN** webhook delivers type `image`
- **THEN** conversation row has `type=image` and raw payload preserved

### Requirement: Realtime inbound delivery complements polling

In addition to REST polling via `GET .../messages?since=`, the system SHALL push realtime `message.inbound` events to connected authenticated clients when inbound list-lead messages are persisted, as defined in capability `inbox-realtime-websocket`. REST polling behavior MUST remain unchanged.

#### Scenario: Polling still works after realtime
- **WHEN** client uses GET with `since` after missing a WebSocket event
- **THEN** missed inbound messages MUST still be returned by the existing REST endpoint

#### Scenario: Realtime does not replace REST
- **WHEN** no WebSocket client is connected
- **THEN** inbound messages MUST still be persisted and retrievable via GET without `since` or with `since`

