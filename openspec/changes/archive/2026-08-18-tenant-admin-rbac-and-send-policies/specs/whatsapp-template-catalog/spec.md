## MODIFIED Requirements

### Requirement: Super admin can sync and list the catalog
The system SHALL allow a `SUPER_ADMIN` to trigger a catalog sync and to list catalog rows including parsed `slots` under `/platform/whatsapp-templates`. Listing MUST NOT require a code deploy when Meta templates change; a successful sync MUST be sufficient.

#### Scenario: Manual sync
- **WHEN** `SUPER_ADMIN` calls `POST /platform/whatsapp-templates/sync`
- **THEN** the system MUST fetch `/{wabaId}/message_templates` for the enabled platform WhatsApp account and upsert catalog rows

#### Scenario: List includes slots
- **WHEN** `SUPER_ADMIN` calls `GET /platform/whatsapp-templates`
- **THEN** each item MUST include `name`, `language`, `status`, and `slots` with stable keys such as `body.1` or `body.customer_name`

### Requirement: Super admin can test-send a catalog template
The system SHALL allow a `SUPER_ADMIN` to send a catalog template to an arbitrary destination number via Cloud API at `/platform/whatsapp-templates/:id/test`. The request MUST accept a `to` phone and a `variables` map keyed by slot keys. An optional `leadId` MAY supply `lead.*` binding values. The send MUST use the template's stored name and language. The system MUST NOT create a `TenantLead` and MUST NOT debit or credit coins.

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
