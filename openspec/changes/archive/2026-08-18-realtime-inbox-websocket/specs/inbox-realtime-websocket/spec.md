# inbox-realtime-websocket Specification

## Purpose

Deliver realtime server-push notifications to authenticated admin clients when a list lead sends an inbound WhatsApp message, using a WebSocket gateway on gym-ctrl with tenant-scoped and super-admin fan-out.

## ADDED Requirements

### Requirement: Authenticated WebSocket connection on gym-ctrl

The system SHALL expose a WebSocket endpoint on gym-ctrl (default path `ws/inbox`) that accepts connections authenticated with the same JWT issued by the login API (`JWT_SECRET`). Unauthenticated or invalid tokens MUST be rejected and the connection closed.

#### Scenario: Valid JWT connects
- **WHEN** client opens WebSocket with a valid non-expired JWT
- **THEN** the connection MUST remain open and the server MUST assign the client to authorization rooms based on JWT claims

#### Scenario: Invalid JWT rejected
- **WHEN** client opens WebSocket with missing or invalid JWT
- **THEN** the connection MUST be closed without joining any room

### Requirement: Room assignment by tenant and super-admin role

On successful connection, the system MUST join the socket to room `tenant:{tenantId}` where `{tenantId}` is the JWT `tenantId` claim. If JWT `roles` includes `SUPER_ADMIN`, the socket MUST also join room `super-admin`.

#### Scenario: Tenant user joins tenant room
- **WHEN** a user with `tenantId=4` and roles `[ADMIN]` connects
- **THEN** the socket MUST be subscribed to room `tenant:4` only

#### Scenario: Super admin joins global room
- **WHEN** a user with `SUPER_ADMIN` role connects
- **THEN** the socket MUST be subscribed to room `super-admin` and room `tenant:{tenantId}`

### Requirement: Inbound list-lead messages trigger message.inbound events

After a new inbound conversation message is persisted for a tenant list lead (`listLeadId` present, `direction=IN`), the system MUST fan-out a JSON event to all sockets in room `tenant:{tenantId}` and room `super-admin`. The event `type` MUST be `message.inbound`.

#### Scenario: Fan-out to tenant and super-admin
- **WHEN** an inbound message is persisted with `tenantId=4`, `listLeadId=99`, and linked list `listId=12`
- **THEN** all connected sockets in `tenant:4` and `super-admin` MUST receive one `message.inbound` event with `tenantId`, `listId`, `leadId`, and message fields

#### Scenario: Outbound message does not emit
- **WHEN** an outbound conversation message is created via API or campaign send
- **THEN** no `message.inbound` WebSocket event MUST be emitted

#### Scenario: Inbound without listLeadId does not emit
- **WHEN** an inbound message is persisted without `listLeadId` (e.g. city outreach correlation only)
- **THEN** no `message.inbound` WebSocket event MUST be emitted

### Requirement: Event payload contract

Each `message.inbound` event MUST include: `type`, `tenantId`, `listId`, `leadId`, and `message` object with at least `id`, `wamid`, `direction` (`IN`), `type`, optional `body`, `phone`, and `createdAt` (ISO8601).

#### Scenario: Payload shape
- **WHEN** a fan-out occurs for a persisted inbound text message
- **THEN** the JSON payload MUST match the documented contract and `message.direction` MUST be `IN`

### Requirement: Internal notify endpoint from notifly

gym-ctrl SHALL expose `POST /internal/inbox/realtime/notify` accepting the same payload as a `message.inbound` event. The request MUST require header `X-Internal-Secret` matching configured `INTERNAL_WS_NOTIFY_SECRET`. Invalid or missing secret MUST respond HTTP 401 and MUST NOT fan-out.

#### Scenario: Authorized internal notify
- **WHEN** notifly POSTs a valid payload with correct `X-Internal-Secret`
- **THEN** gym-ctrl MUST fan-out to appropriate rooms and respond HTTP 204 or 200

#### Scenario: Unauthorized internal notify
- **WHEN** POST lacks or mismatches `X-Internal-Secret`
- **THEN** HTTP 401 MUST be returned and no WebSocket message MUST be sent

### Requirement: Notify failure must not fail Meta webhook

When notifly fails to call the internal notify endpoint (network error, 5xx, timeout), the webhook handler MUST still complete successfully for Meta (HTTP 200) and MUST log the failure.

#### Scenario: Notify down
- **WHEN** gym-ctrl internal notify is unreachable after inbound persist
- **THEN** webhook responds 200 to Meta and error is logged
