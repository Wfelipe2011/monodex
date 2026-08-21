# whatsapp-template-catalog Specification

## Purpose

Mirror Meta WhatsApp message templates for the platform WABA, expose parsed slots to super-admin APIs, and allow test-sends without funnel or coin side effects.
## Requirements
### Requirement: Catalog mirrors Meta message templates for a WABA
The system SHALL persist WhatsApp message templates synced from the Meta Graph API for the **default** platform `WhatsappAccount`, keyed by `(whatsappAccountId, name, language)` on that default account. Each row MUST store at least Meta status, category, parameter format, raw `components` JSON, parsed `slots` JSON, and `lastSyncedAt`. The access token MUST be read from the default account `tokenEnvKey` environment variable and MUST NOT be stored on the template row. Sync MUST NOT create duplicate catalog rows for additional `phoneNumberId`s that share the same `wabaId`.

#### Scenario: Sync upserts a template
- **WHEN** Graph returns an approved template `test_gladson` language `pt_BR` for the platform WABA
- **THEN** a catalog row for the default account, name, and language MUST exist with status approved and `slots` derived from its components

#### Scenario: Sync updates status
- **WHEN** a previously approved catalog row is returned by Graph as `REJECTED`
- **THEN** the catalog row MUST be updated to that status on the next successful sync

#### Scenario: Extra numbers do not duplicate catalog
- **WHEN** a second platform account exists on the same `wabaId` and sync runs
- **THEN** the system MUST NOT insert a second catalog row keyed by that second account for the same name and language

### Requirement: Super admin can sync and list the catalog
The system SHALL allow a `SUPER_ADMIN` to trigger a catalog sync and to list catalog rows including parsed `slots` under `/platform/whatsapp-templates`. Listing MUST NOT require a code deploy when Meta templates change; a successful sync MUST be sufficient.

#### Scenario: Manual sync
- **WHEN** `SUPER_ADMIN` calls `POST /platform/whatsapp-templates/sync`
- **THEN** the system MUST fetch `/{wabaId}/message_templates` for the enabled **default** platform WhatsApp account and upsert catalog rows on that account

#### Scenario: List includes slots
- **WHEN** `SUPER_ADMIN` calls `GET /platform/whatsapp-templates`
- **THEN** each item MUST include `name`, `language`, `status`, and `slots` with stable keys such as `body.1` or `body.customer_name`

### Requirement: Super admin can test-send a catalog template
The system SHALL allow a `SUPER_ADMIN` to send a catalog template to an arbitrary destination number via Cloud API at `/platform/whatsapp-templates/:id/test`. The request MUST accept a `to` phone and a `variables` map keyed by slot keys. An optional `leadId` MAY supply `lead.*` binding values. The send MUST use the template's stored name and language. The system MUST NOT create a `TenantLead` and MUST NOT debit or credit coins. When the send uses a dedicated (`isDefault=false`) platform account assigned to a tenant via outreach config, the system MUST upsert that tenant's conversation thread for the destination phone and persist an outbound template message with the Graph `wamid`. When the send uses the default account or an unassigned dedicated account, the system MUST NOT write a conversation thread.

#### Scenario: Test send with explicit variables
- **WHEN** `SUPER_ADMIN` posts `{ "to": "11999999999", "variables": { "body.1": "Demo" } }` for an approved template whose only required text slot is `body.1`
- **THEN** the system MUST POST a Cloud API template message to the normalized destination and MUST NOT write `TenantLead` or `CoinTransaction`

#### Scenario: Missing slot rejected
- **WHEN** a required slot has neither a `variables` entry nor a resolvable `leadId`/`now.*` value
- **THEN** the API MUST respond HTTP 400 and MUST NOT call Cloud API

#### Scenario: Non-approved template rejected
- **WHEN** the catalog row status is not `APPROVED`
- **THEN** the API MUST respond HTTP 400 and MUST NOT call Cloud API

#### Scenario: Non super-admin forbidden
- **WHEN** a user without `SUPER_ADMIN` calls the test-send endpoint
- **THEN** the API MUST respond HTTP 403

#### Scenario: Dedicated test send writes conversation
- **WHEN** test-send uses `whatsappAccountId` of a dedicated account assigned to tenant 4 and Graph returns `wamid` W
- **THEN** tenant 4 MUST have a conversation thread for the destination phone with an outbound template message W

#### Scenario: Default test send skips conversation
- **WHEN** test-send uses the platform default account
- **THEN** no conversation thread MUST be written

