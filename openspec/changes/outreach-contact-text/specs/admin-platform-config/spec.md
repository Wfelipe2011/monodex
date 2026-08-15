## MODIFIED Requirements

### Requirement: Super admin manages tenant outreach config
The system SHALL allow a `SUPER_ADMIN` to get, put (upsert), and patch `TenantOutreachConfig` for a tenant, including `enabled`, `costPerLead`, `cashbackOnReply`, `outreachTemplateName`, `notifyTenantTemplateName`, `schedule`, `categories`, `leadsPerRun`, `headerImageUrl`, `sendIntervalSeconds`, and `outreachContactText`. PUT MUST require `outreachContactText`. PATCH MAY omit it to leave the stored value unchanged.

#### Scenario: Upsert outreach config
- **WHEN** `SUPER_ADMIN` sends a full config body including `outreachContactText` to `PUT /admin/tenants/:tenantId/outreach-config`
- **THEN** the config is created or replaced for that tenant and returned including `outreachContactText`

#### Scenario: Toggle enabled
- **WHEN** `SUPER_ADMIN` patches `{ enabled: true }` on a tenant that has `phone` set and `active` true and remaining required fields already present including non-empty `outreachContactText`
- **THEN** `outreachConfig.enabled` becomes true

#### Scenario: PUT without contact text rejected
- **WHEN** `SUPER_ADMIN` PUTs an outreach config omitting `outreachContactText`
- **THEN** the API responds with HTTP 400

### Requirement: Enabling outreach validates tenant readiness
The system SHALL reject enabling outreach (`enabled=true`) when the tenant has no usable `phone`, when `Tenant.active` is false, or when `outreachContactText` is missing or empty after trim.

#### Scenario: Enable without phone rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true for a tenant with null or empty `phone`
- **THEN** the API responds with HTTP 400 and leaves enabled false (or does not persist enabled true)

#### Scenario: Enable on inactive tenant rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true for a tenant with `active` false
- **THEN** the API responds with HTTP 400

#### Scenario: Enable without contact text rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true and the merged `outreachContactText` is empty
- **THEN** the API responds with HTTP 400
