## MODIFIED Requirements

### Requirement: Inbound list-lead messages trigger web push for eligible offline users
When `publishInbound` runs for a `message.inbound` event with `displayName` and `conversationId`, the system MUST send Web Push to all users where `user.tenantId` equals event `tenantId` OR `SUPER_ADMIN` is in `user.roles`, excluding users with at least one OPEN inbox WebSocket connection at dispatch time.

#### Scenario: Tenant user offline receives push
- **WHEN** inbound is published for tenant 4 and user A (tenant 4) has subscription and no OPEN WS
- **THEN** user A's subscription receives a push notification

#### Scenario: Super admin offline receives push for any tenant
- **WHEN** inbound is published for tenant 4 and super-admin B has subscription and no OPEN WS
- **THEN** super-admin B receives push

#### Scenario: User with open WebSocket skipped
- **WHEN** user A has OPEN inbox WebSocket during publishInbound
- **THEN** no Web Push is sent to user A's subscriptions

#### Scenario: No conversation context
- **WHEN** inbound is not persisted onto a conversation thread
- **THEN** no web push is sent

### Requirement: Notification title and body include lead context and message preview
Push payload MUST use title `Nova mensagem de {displayName}` (fallback to normalized phone if name empty). Body MUST contain a preview of the inbound message: text/body truncated to a reasonable length for text and button types; non-text types MAY use a short generic preview.

#### Scenario: Text inbound preview
- **WHEN** inbound body is "Olá, tenho interesse!" and displayName is "João"
- **THEN** title is "Nova mensagem de João" and body contains message preview

#### Scenario: WhatsApp-style thread tag
- **WHEN** multiple inbound messages arrive for the same conversationId
- **THEN** push notifications MUST use the same `tag` value `inbox-conversation-{conversationId}` so the OS replaces the prior notification for that conversation

### Requirement: Push payload includes deep-link data
Each push MUST include `data.url` pointing to `/tenant/{tenantId}/conversations/{conversationId}` plus `tenantId`, `conversationId`, and `messageId`. The payload MUST NOT require `listId` or `leadId`.

#### Scenario: Click opens conversation
- **WHEN** user activates the notification in the Service Worker
- **THEN** documented URL in `data.url` identifies the correct conversation thread
