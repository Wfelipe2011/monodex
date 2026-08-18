## MODIFIED Requirements

### Requirement: Users can register push subscriptions
The system SHALL allow authenticated users to register a Web Push subscription via `PUT /tenant/push-subscriptions` with body `{ endpoint, keys: { p256dh, auth } }`. Subscriptions MUST be stored linked to the authenticated `userId`. The same `endpoint` MUST upsert (update keys/user) rather than duplicate. When `Tenant.active` is false for the user's tenant, PUT and DELETE MUST be rejected with HTTP 403 (consultative lock); GET of other tenant resources remains specified elsewhere.

#### Scenario: Register subscription
- **WHEN** authenticated user of an active tenant PUTs valid subscription JSON
- **THEN** a `PushSubscription` row exists for that user and endpoint

#### Scenario: Delete subscription
- **WHEN** authenticated user of an active tenant DELETEs with `{ endpoint }` matching their subscription
- **THEN** the row is removed

### Requirement: Push payload includes deep-link data
Each push MUST include `data.url` pointing to the list lead conversation path `/tenant/{tenantId}/lead-lists/{listId}/leads/{leadId}` plus `tenantId`, `listId`, `leadId`, and `messageId`.

#### Scenario: Click opens conversation
- **WHEN** user activates the notification in the Service Worker
- **THEN** documented URL in `data.url` identifies the correct lead thread
