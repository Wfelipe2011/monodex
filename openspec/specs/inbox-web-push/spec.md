# inbox-web-push Specification

## Purpose

Deliver Web Push notifications (VAPID) to authenticated users when a list lead sends an inbound WhatsApp message and the user does not have an active WebSocket connection, with WhatsApp-style conversation grouping and lead-aware title/body.

## Requirements

### Requirement: Users can register push subscriptions

The system SHALL allow authenticated users to register a Web Push subscription via `PUT /tenant/push-subscriptions` with body `{ endpoint, keys: { p256dh, auth } }`. Subscriptions MUST be stored linked to the authenticated `userId`. The same `endpoint` MUST upsert (update keys/user) rather than duplicate. When `Tenant.active` is false for the user's tenant, PUT and DELETE MUST be rejected with HTTP 403 (consultative lock); GET of other tenant resources remains specified elsewhere.

#### Scenario: Register subscription
- **WHEN** authenticated user of an active tenant PUTs valid subscription JSON
- **THEN** a `PushSubscription` row exists for that user and endpoint

#### Scenario: Delete subscription
- **WHEN** authenticated user of an active tenant DELETEs with `{ endpoint }` matching their subscription
- **THEN** the row is removed

### Requirement: VAPID is configured globally on gym-ctrl

gym-ctrl MUST use a single global VAPID key pair (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) to send push messages. Keys MUST NOT vary per tenant.

#### Scenario: Send uses global VAPID
- **WHEN** push is dispatched for tenant 4
- **THEN** the same VAPID credentials are used as for tenant 99

### Requirement: Inbound list-lead messages trigger web push for eligible offline users

When `publishInbound` runs for a `message.inbound` event with `leadName`, the system MUST send Web Push to all users where `user.tenantId` equals event `tenantId` OR `SUPER_ADMIN` is in `user.roles`, excluding users with at least one OPEN inbox WebSocket connection at dispatch time.

#### Scenario: Tenant user offline receives push
- **WHEN** inbound is published for tenant 4 and user A (tenant 4) has subscription and no OPEN WS
- **THEN** user A's subscription receives a push notification

#### Scenario: Super admin offline receives push for any tenant
- **WHEN** inbound is published for tenant 4 and super-admin B has subscription and no OPEN WS
- **THEN** super-admin B receives push

#### Scenario: User with open WebSocket skipped
- **WHEN** user A has OPEN inbox WebSocket during publishInbound
- **THEN** no Web Push is sent to user A's subscriptions

#### Scenario: No list lead context
- **WHEN** event lacks list-lead context (not applicable to current internal notify path)
- **THEN** no web push is sent

### Requirement: Notification title and body include lead context and message preview

Push payload MUST use title `Nova mensagem de {leadName}` (fallback to normalized phone if name empty). Body MUST contain a preview of the inbound message: text/body truncated to a reasonable length for text and button types; non-text types MAY use a short generic preview.

#### Scenario: Text inbound preview
- **WHEN** inbound body is "Olá, tenho interesse!" and leadName is "João"
- **THEN** title is "Nova mensagem de João" and body contains message preview

#### Scenario: WhatsApp-style thread tag
- **WHEN** multiple inbound messages arrive for the same leadId
- **THEN** push notifications MUST use the same `tag` value `inbox-lead-{leadId}` so the OS replaces the prior notification for that conversation

### Requirement: Push payload includes deep-link data

Each push MUST include `data.url` pointing to the list lead conversation path `/tenant/{tenantId}/lead-lists/{listId}/leads/{leadId}` plus `tenantId`, `listId`, `leadId`, and `messageId`.

#### Scenario: Click opens conversation
- **WHEN** user activates the notification in the Service Worker
- **THEN** documented URL in `data.url` identifies the correct lead thread

### Requirement: Expired subscriptions are removed

When the push service returns HTTP 410 Gone for a subscription, the system MUST delete that subscription row and MUST NOT fail the inbound notify request.

#### Scenario: Gone subscription cleanup
- **WHEN** web-push returns 410 for an endpoint
- **THEN** subscription is deleted from database
