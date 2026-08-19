## MODIFIED Requirements

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
