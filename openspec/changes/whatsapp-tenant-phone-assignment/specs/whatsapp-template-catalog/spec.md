## MODIFIED Requirements

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
