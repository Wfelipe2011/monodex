## ADDED Requirements

### Requirement: Pool prospecting campaigns exist per tenant
The system SHALL persist zero or more outreach campaigns per tenant for global `Lead` pool prospecting. Each campaign MUST include at least: `name`, `enabled`, `schedule` JSON (weekday → hours UTC, same shape as list campaigns), `categories` JSON (string array), `leadsPerRun` (≥ 1), `sendIntervalSeconds` (≥ 0), `outreachTemplateId`, `notifyTemplateId`, `slotBindings` JSON with role keys `outreach` and `notify`, and optional `cityId` (null means all cities allowed by `TenantSendPolicy`). Create, list, get, patch, and delete MUST be tenant `ADMIN` actions under `/tenant/:tenantId/outreach-campaigns`. `SUPER_ADMIN` MUST follow the same bootstrap window rules as other tenant resources.

#### Scenario: Create campaign
- **WHEN** `ADMIN` posts a valid campaign body with granted template ids for tenant 4
- **THEN** the campaign is persisted with `tenantId` 4

#### Scenario: Multiple campaigns allowed
- **WHEN** tenant 4 already has one enabled campaign
- **THEN** `ADMIN` MAY create a second campaign on the same tenant

#### Scenario: Ungranted template rejected
- **WHEN** `ADMIN` sets `outreachTemplateId` to a catalog row not granted to tenant 4
- **THEN** the write MUST be rejected with HTTP 400

### Requirement: Campaign enable requires approved templates and bindings
The system SHALL reject `enabled=true` on a campaign unless both template FKs are set, both templates are `APPROVED`, and every required slot of each template has a binding under the matching role key.

#### Scenario: Enable without notify template rejected
- **WHEN** `ADMIN` patches `{ enabled: true }` and `notifyTemplateId` is null
- **THEN** the write MUST be rejected with HTTP 400

#### Scenario: Incomplete outreach bindings rejected
- **WHEN** the outreach template requires `body.1` and `slotBindings.outreach` omits `body.1`
- **THEN** the write MUST be rejected with HTTP 400

### Requirement: Campaign send knobs are validated
The system SHALL reject campaign writes when `leadsPerRun` is less than 1 or `sendIntervalSeconds` is less than 0.

#### Scenario: Zero leads per run rejected
- **WHEN** a client sets `leadsPerRun` to 0
- **THEN** the write MUST be rejected

### Requirement: Campaign city filter respects send policy
When `TenantSendPolicy` has non-empty `allowedCityIds`, a campaign's optional `cityId` MUST be null or a member of that allowlist. When the allowlist contains exactly one city id, the API MUST reject writes that set a different non-null `cityId`. When both policy city arrays are empty, `cityId` null MUST mean no extra city filter beyond global lead data. Campaign city filter MUST NOT override denylist or exclusivity rules on `TenantSendPolicy`.

#### Scenario: Campaign city within allowlist
- **WHEN** tenant 4 has `allowedCityIds: [1, 2]` and `ADMIN` creates a campaign with `cityId: 1`
- **THEN** the campaign is persisted

#### Scenario: Campaign city outside allowlist rejected
- **WHEN** tenant 4 has `allowedCityIds: [1]` and `ADMIN` sets `cityId: 2`
- **THEN** the write MUST be rejected with HTTP 400

#### Scenario: Single-city tenant cannot pick another city
- **WHEN** tenant 4 has `allowedCityIds: [7]` only and `ADMIN` sets `cityId: 8`
- **THEN** the write MUST be rejected with HTTP 400

#### Scenario: Unrestricted policy allows null city
- **WHEN** tenant 4 has empty allow and deny city arrays and `cityId` is null
- **THEN** selection for that campaign MUST NOT add a city id filter beyond policy

### Requirement: Master pool switch disables all campaigns
When `TenantOutreachConfig.enabled` is false, the pool prospecting scheduler MUST NOT run any campaign for that tenant regardless of per-campaign `enabled`. List campaigns and on-demand sends MUST NOT be affected.

#### Scenario: Master off skips campaigns
- **WHEN** config `enabled` is false and a campaign has `enabled` true and matching schedule
- **THEN** notifly MUST NOT send pool prospecting messages for that tenant

#### Scenario: Master on allows enabled campaigns
- **WHEN** config `enabled` is true, tenant is active with phone, and campaign A has `enabled` true and matching schedule
- **THEN** campaign A MAY be processed subject to balance and templates
