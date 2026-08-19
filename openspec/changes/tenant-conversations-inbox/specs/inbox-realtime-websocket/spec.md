## MODIFIED Requirements

### Requirement: Inbound list-lead messages trigger message.inbound events
After a new inbound conversation message is persisted on a dedicated-number thread (`conversationId` present, `direction=IN`), the system MUST fan-out a JSON event to all sockets in room `tenant:{tenantId}` and room `super-admin`. The event `type` MUST be `message.inbound`. The system MUST ALSO trigger web push dispatch for eligible offline users as defined in capability `inbox-web-push`.

#### Scenario: Fan-out to tenant and super-admin
- **WHEN** an inbound message is persisted with `tenantId=4` and `conversationId=88`
- **THEN** all connected sockets in `tenant:4` and `super-admin` MUST receive one `message.inbound` event with `tenantId`, `conversationId`, `displayName`, and message fields

#### Scenario: Outbound message does not emit
- **WHEN** an outbound conversation message is created via API or template send
- **THEN** no `message.inbound` WebSocket event MUST be emitted

#### Scenario: Inbound without conversation thread does not emit
- **WHEN** an inbound webhook is skipped because the number is default or tenant cannot be resolved
- **THEN** no `message.inbound` WebSocket event MUST be emitted

#### Scenario: Web push complements websocket
- **WHEN** publishInbound runs and eligible users have push subscriptions but no OPEN WebSocket
- **THEN** those users MUST receive web push per `inbox-web-push` spec

### Requirement: Internal inbound payload includes lead name
The internal notify payload for `message.inbound` MUST include `displayName` (string) sourced from the conversation thread snapshot.

#### Scenario: Notify includes displayName
- **WHEN** notifly POSTs internal notify after persisting inbound for a thread named "Maria"
- **THEN** JSON body includes `displayName: "Maria"`

### Requirement: Event payload contract
Each `message.inbound` event MUST include: `type`, `tenantId`, `conversationId`, `displayName`, and `message` object with at least `id`, `wamid`, `direction` (`IN`), `type`, optional `body`, `phone`, and `createdAt` (ISO8601). The payload MUST NOT require `listId` or `leadId`.

#### Scenario: Payload shape
- **WHEN** a fan-out occurs for a persisted inbound text message
- **THEN** the JSON payload MUST match the documented contract, `message.direction` MUST be `IN`, and `conversationId` MUST be present
