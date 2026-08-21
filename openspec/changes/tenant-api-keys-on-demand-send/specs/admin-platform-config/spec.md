## ADDED Requirements

### Requirement: Super Admin writes tenant API access flag
The system SHALL allow `SUPER_ADMIN` to PATCH `apiAccessEnabled` on `/platform/tenants/:id` at any time. Tenant `ADMIN` MUST NOT persist this field. GET of a tenant (platform or tenant home as applicable) MUST include the current flag for operators that already read tenant records.

#### Scenario: Super Admin enables API access
- **WHEN** `SUPER_ADMIN` patches `{ "apiAccessEnabled": true }` on tenant 4
- **THEN** the flag is persisted

#### Scenario: Admin body with apiAccessEnabled rejected
- **WHEN** tenant `ADMIN` includes `apiAccessEnabled` in a tenant PATCH
- **THEN** the API responds with HTTP 403 and the flag is unchanged

### Requirement: Super Admin writes on-demand send price
The system SHALL allow `SUPER_ADMIN` to PATCH platform-owned `costPerOnDemandSend` (number ≥ 0) on `/platform/tenants/:tenantId/outreach-config` at any time. Tenant `ADMIN` bodies that include `costPerOnDemandSend` MUST be rejected with HTTP 403. GET of outreach config (platform and tenant read) MUST include the field. Default for new configs MUST be 0.

#### Scenario: Super Admin sets on-demand price
- **WHEN** `SUPER_ADMIN` patches `{ "costPerOnDemandSend": 0.4 }`
- **THEN** the value is persisted

#### Scenario: Admin cannot set on-demand price
- **WHEN** `ADMIN` patches `{ "costPerOnDemandSend": 0.01 }`
- **THEN** the API responds with HTTP 403 and the stored price is unchanged

#### Scenario: New config defaults to zero
- **WHEN** a new outreach config is created without `costPerOnDemandSend`
- **THEN** `costPerOnDemandSend` MUST be 0
