## ADDED Requirements

### Requirement: Conversation thread identity is tenant plus phone
The system SHALL persist a conversation thread per unique pair `(tenantId, phone)` (phone normalized the same way as list-campaign phones). Each thread MUST store a `displayName` snapshot, `lastMessageAt`, and optional `lastInboundAt`. Conversation messages MUST reference that thread via `conversationId`. `listLeadId` / `listSendId` MAY exist as provenance and MUST NOT be required for persist, notify, list, or reply.

#### Scenario: Same phone reuses thread
- **WHEN** a second inbound from phone P arrives for tenant T that already has a thread for P
- **THEN** the system MUST append the message to that thread and MUST NOT create a second thread

#### Scenario: Cold inbound creates thread
- **WHEN** inbound arrives on the tenant's dedicated Cloud API number from an unknown phone
- **THEN** a thread for `(T, phone)` MUST be created and the message stored with `direction=IN`

### Requirement: Dedicated Cloud API number is required for conversation writes
The system MUST upsert a thread and persist a conversation message only when the Cloud API `phone_number_id` (inbound metadata or resolved outbound credentials) belongs to a platform `WhatsappAccount` with `isDefault=false` assigned to that tenant via `TenantOutreachConfig.whatsappAccountId`. Writes MUST NOT occur for the platform default number. POST of a free-text reply MUST be rejected with HTTP 400 when the tenant has no dedicated number.

#### Scenario: Dedicated inbound persisted
- **WHEN** webhook `phone_number_id` is the dedicated account assigned to tenant 4
- **THEN** the inbound MUST be persisted on tenant 4's thread for `msg.from`

#### Scenario: Default inbound without tenant skip
- **WHEN** webhook `phone_number_id` is the platform default account and no dedicated assignment applies
- **THEN** the system MUST NOT create a conversation thread for that event

#### Scenario: Reply without dedicated rejected
- **WHEN** `ADMIN` POSTs text to a conversation and the tenant has `whatsappAccountId` null
- **THEN** the API MUST respond HTTP 400 and MUST NOT call Graph

### Requirement: Cold inbound display name comes from webhook contacts
When creating or updating a thread from inbound, `displayName` MUST be `contacts[].profile.name` for the matching `wa_id` when that name is non-empty after trim. Otherwise `displayName` MUST be the normalized phone. A later inbound that includes a non-empty profile name MUST overwrite `displayName`. An inbound without a profile name MUST leave the existing `displayName` unchanged.

#### Scenario: Profile name used
- **WHEN** webhook contacts include `{ "wa_id": "<from>", "profile": { "name": "Maria" } }`
- **THEN** the thread `displayName` MUST be `Maria`

#### Scenario: Phone used when name missing
- **WHEN** inbound has no matching non-empty `profile.name`
- **THEN** a newly created thread `displayName` MUST equal the normalized phone

### Requirement: Operators can list conversation threads
The system SHALL allow tenant `ADMIN` and `SUPER_ADMIN` to `GET /tenant/:tenantId/conversations`. Results MUST be ordered by `lastMessageAt` descending and MUST include at least: thread id, phone, displayName, lastMessageAt, lastInboundAt, `windowOpen` (true when last inbound is within 24 hours), and a summary of the latest message. The response MUST NOT require a list id or city-lead id.

#### Scenario: Admin lists threads
- **WHEN** `ADMIN` of tenant 4 calls `GET /tenant/4/conversations`
- **THEN** the response MUST list that tenant's threads newest-activity first

#### Scenario: Super admin can list
- **WHEN** `SUPER_ADMIN` GETs `/tenant/4/conversations`
- **THEN** the API MUST return the list (or empty array), not HTTP 403 for role

## MODIFIED Requirements

### Requirement: Conversation messages are stored separately from send statuses
The system SHALL persist conversation messages in a dedicated store distinct from delivery status events. Each row MUST include at least: Meta `wamid` (unique), `direction` (`IN` | `OUT`), `type` (e.g. `text`, `button`, `template`, `image`, `audio`, `document`, `unknown`), optional normalized `body` text, raw payload JSON, normalized destination/origin `phone`, `tenantId`, and `conversationId` linking to the tenant phone thread. Delivery statuses MUST NOT be written into conversation message rows.

#### Scenario: Inbound webhook creates message
- **WHEN** webhook delivers an inbound `messages` event that passes the dedicated-number gate
- **THEN** a conversation message row with `direction=IN` and the Meta `wamid` MUST be created on the thread for that phone

#### Scenario: Outbound API creates message
- **WHEN** tenant `ADMIN` sends text via the conversation API and Graph returns `wamid`
- **THEN** a conversation message row with `direction=OUT` MUST be created with that `wamid` on the same thread

### Requirement: Outbound template sends from list campaigns are recorded
When a Cloud API template is accepted (HTTP 200 with `wamid`) and the send uses the tenant's dedicated number, the system MUST upsert the conversation thread for the **recipient phone** and record an outbound conversation message (`type=template`) including that `wamid`. This MUST apply to list-campaign sends to the list lead, city outreach `contactLeads` sends to the lead, and catalog test-sends whose `whatsappAccountId` is that dedicated account. Template notifies sent to `Tenant.phone` MUST NOT be written onto a lead conversation thread.

#### Scenario: Campaign template outbound stored
- **WHEN** list campaign cron successfully sends a template to a list lead on a dedicated number
- **THEN** an outbound conversation message exists on that phone's thread with the Graph `wamid`

#### Scenario: City outreach template outbound stored
- **WHEN** `contactLeads` successfully sends a template to a lead for a tenant with a dedicated number
- **THEN** an outbound conversation message exists on that lead phone's thread with the Graph `wamid`

#### Scenario: Test send on dedicated stored
- **WHEN** `SUPER_ADMIN` test-sends a catalog template using a dedicated account assigned to tenant 4
- **THEN** an outbound conversation message exists on tenant 4's thread for the destination phone

#### Scenario: Notify to tenant phone is not a lead thread
- **WHEN** a list-campaign NOTIFY or city interest notify is sent to `Tenant.phone`
- **THEN** that outbound MUST NOT be appended to a conversation thread keyed by the lead's phone

### Requirement: Super admin can read conversation history
The system SHALL allow tenant `ADMIN` to list conversation messages for a thread via `GET /tenant/:tenantId/conversations/:conversationId/messages` with optional `since` ISO timestamp for polling. Messages MUST be ordered ascending by creation time. `SUPER_ADMIN` MUST be allowed to GET the same resource and MUST NOT be allowed to POST replies.

#### Scenario: Poll with since
- **WHEN** client calls GET with `since` set to last seen timestamp
- **THEN** only messages created after `since` MUST be returned

#### Scenario: Super admin GET allowed
- **WHEN** `SUPER_ADMIN` GETs messages for a conversation of tenant 4
- **THEN** the API returns the message list (or 404 if missing), not 403 for role

### Requirement: Super admin can send free-text replies within Meta window
The system SHALL allow tenant `ADMIN` to POST `{ text }` on `/tenant/:tenantId/conversations/:conversationId/messages` to send a Cloud API text message to the thread phone. The request MUST be rejected with HTTP 400 when no inbound message on that thread exists within the last 24 hours (Meta customer care window) or when the tenant has no dedicated number. Successful sends MUST use credentials resolved for that tenant and persist outbound conversation messages. `SUPER_ADMIN` POST MUST return HTTP 403.

#### Scenario: Send within window
- **WHEN** last inbound on the thread was 2 hours ago and text is non-empty and `ADMIN` of that tenant posts
- **THEN** Graph text message is sent and outbound row is created

#### Scenario: Send outside window rejected
- **WHEN** no inbound on that thread in the last 24 hours
- **THEN** API responds HTTP 400 and MUST NOT call Graph

#### Scenario: Super admin reply after bootstrap rejected
- **WHEN** `SUPER_ADMIN` POSTs a reply and no bootstrap window applies to that conversation resource
- **THEN** the API responds with HTTP 403

### Requirement: Basic media types are stored without full download in MVP
For inbound types other than `text` and `button`, the system MUST persist `type` and raw webhook JSON. Full media download from Meta CDN is out of scope for MVP.

#### Scenario: Inbound image stored as raw
- **WHEN** webhook delivers type `image` on a dedicated number
- **THEN** conversation row has `type=image` and raw payload preserved

### Requirement: Realtime inbound delivery complements polling
In addition to REST polling via `GET /tenant/:tenantId/conversations/:conversationId/messages?since=`, the system SHALL push realtime `message.inbound` events to connected authenticated clients when inbound conversation messages are persisted on a thread, as defined in capability `inbox-realtime-websocket`. REST polling behavior MUST remain unchanged.

#### Scenario: Polling still works after realtime
- **WHEN** client uses GET with `since` after missing a WebSocket event
- **THEN** missed inbound messages MUST still be returned by the conversation messages endpoint

#### Scenario: Realtime does not replace REST
- **WHEN** no WebSocket client is connected
- **THEN** inbound messages MUST still be persisted and retrievable via GET without `since` or with `since`
