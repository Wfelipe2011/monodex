# inbox-realtime-websocket Specification

## Purpose

Delta: extend internal inbound notify and publish path to support web push complement and lead name.

## ADDED Requirements

### Requirement: Internal inbound payload includes lead name

The internal notify payload for `message.inbound` MUST include `leadName` (string) sourced from `TenantListLead.name` when notifying gym-ctrl.

#### Scenario: Notify includes leadName
- **WHEN** notifly POSTs internal notify after persisting inbound for list lead "Maria"
- **THEN** JSON body includes `leadName: "Maria"`

## MODIFIED Requirements

### Requirement: Inbound list-lead messages trigger message.inbound events

After a new inbound conversation message is persisted for a tenant list lead (`listLeadId` present, `direction=IN`), the system MUST fan-out a JSON event to all sockets in room `tenant:{tenantId}` and room `super-admin`. The event `type` MUST be `message.inbound`. The system MUST ALSO trigger web push dispatch for eligible offline users as defined in capability `inbox-web-push`.

#### Scenario: Fan-out to tenant and super-admin
- **WHEN** an inbound message is persisted with `tenantId=4`, `listLeadId=99`, and linked list `listId=12`
- **THEN** all connected sockets in `tenant:4` and `super-admin` MUST receive one `message.inbound` event with `tenantId`, `listId`, `leadId`, `leadName`, and message fields

#### Scenario: Outbound message does not emit
- **WHEN** an outbound conversation message is created via API or campaign send
- **THEN** no `message.inbound` WebSocket event MUST be emitted

#### Scenario: Inbound without listLeadId does not emit
- **WHEN** an inbound message is persisted without `listLeadId` (e.g. city outreach correlation only)
- **THEN** no `message.inbound` WebSocket event MUST be emitted

#### Scenario: Web push complements websocket
- **WHEN** publishInbound runs and eligible users have push subscriptions but no OPEN WebSocket
- **THEN** those users MUST receive web push per `inbox-web-push` spec
