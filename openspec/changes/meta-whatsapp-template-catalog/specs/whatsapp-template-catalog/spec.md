## ADDED Requirements

### Requirement: Catalog mirrors Meta message templates for a WABA
The system SHALL persist WhatsApp message templates synced from the Meta Graph API for a `WhatsappAccount`, keyed by `(whatsappAccountId, name, language)`. Each row MUST store at least Meta status, category, parameter format, raw `components` JSON, parsed `slots` JSON, and `lastSyncedAt`. The access token MUST be read from the account `tokenEnvKey` environment variable and MUST NOT be stored on the template row.

#### Scenario: Sync upserts a template
- **WHEN** Graph returns an approved template `test_gladson` language `pt_BR` for the platform account WABA
- **THEN** a catalog row for that account, name, and language MUST exist with status approved and `slots` derived from its components

#### Scenario: Sync updates status
- **WHEN** a previously approved catalog row is returned by Graph as `REJECTED`
- **THEN** the catalog row MUST be updated to that status on the next successful sync

### Requirement: Super admin can sync and list the catalog
The system SHALL allow a `SUPER_ADMIN` to trigger a catalog sync and to list catalog rows including parsed `slots`. Listing MUST NOT require a code deploy when Meta templates change; a successful sync MUST be sufficient.

#### Scenario: Manual sync
- **WHEN** `SUPER_ADMIN` calls `POST /admin/whatsapp-templates/sync`
- **THEN** the system MUST fetch `/{wabaId}/message_templates` for the enabled platform WhatsApp account and upsert catalog rows

#### Scenario: List includes slots
- **WHEN** `SUPER_ADMIN` calls `GET /admin/whatsapp-templates`
- **THEN** each item MUST include `name`, `language`, `status`, and `slots` with stable keys such as `body.1` or `body.customer_name`

### Requirement: Super admin can test-send a catalog template
The system SHALL allow a `SUPER_ADMIN` to send a catalog template to an arbitrary destination number via Cloud API. The request MUST accept a `to` phone and a `variables` map keyed by slot keys. An optional `leadId` MAY supply `lead.*` binding values. The send MUST use the template's stored name and language. The system MUST NOT create a `TenantLead` and MUST NOT debit or credit coins.

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
