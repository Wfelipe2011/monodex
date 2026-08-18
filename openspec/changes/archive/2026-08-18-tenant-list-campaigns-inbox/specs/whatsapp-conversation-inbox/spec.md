# whatsapp-conversation-inbox Specification

## Purpose

Persist inbound and outbound WhatsApp Cloud API conversation messages for tenant list leads and expose super-admin APIs for history and free-text replies (Meta 24h window).

## ADDED Requirements

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
The system SHALL allow `SUPER_ADMIN` to list conversation messages for a list lead via `GET /admin/tenants/:tenantId/lead-lists/:listId/leads/:leadId/messages` with optional `since` ISO timestamp for polling. Messages MUST be ordered ascending by creation time.

#### Scenario: Poll with since
- **WHEN** client calls GET with `since` set to last seen timestamp
- **THEN** only messages created after `since` MUST be returned

### Requirement: Super admin can send free-text replies within Meta window
The system SHALL allow `SUPER_ADMIN` to POST `{ text }` to send a Cloud API text message to the list lead's phone. The request MUST be rejected with HTTP 400 when no inbound message from that phone exists within the last 24 hours (Meta customer care window). Successful sends MUST use the platform Cloud API account and persist outbound conversation messages.

#### Scenario: Send within window
- **WHEN** last inbound from the lead's phone was 2 hours ago and text is non-empty
- **THEN** Graph text message is sent and outbound row is created

#### Scenario: Send outside window rejected
- **WHEN** no inbound from that phone in the last 24 hours
- **THEN** API responds HTTP 400 and MUST NOT call Graph

### Requirement: Basic media types are stored without full download in MVP
For inbound types other than `text` and `button`, the system MUST persist `type` and raw webhook JSON. Full media download from Meta CDN is out of scope for MVP.

#### Scenario: Inbound image stored as raw
- **WHEN** webhook delivers type `image`
- **THEN** conversation row has `type=image` and raw payload preserved
