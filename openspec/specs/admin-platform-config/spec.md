# admin-platform-config Specification

## Purpose

Super-admin API to manage `TenantOutreachConfig` and platform `WhatsappAccount` (no Meta token storage).

## Requirements

### Requirement: Super admin manages tenant outreach config
The system SHALL allow a `SUPER_ADMIN` to get, put (upsert), and patch `TenantOutreachConfig` for a tenant, including `enabled`, `costPerLead`, `cashbackOnReply`, `outreachTemplateId`, `notifyTemplateId`, `slotBindings`, `schedule`, `categories`, `leadsPerRun`, and `sendIntervalSeconds`. PUT MUST require both template ids and `slotBindings`. PATCH MAY omit them to leave stored values unchanged. The API MUST reject bodies that include `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, or `headerImageUrl`.

#### Scenario: Upsert outreach config
- **WHEN** `SUPER_ADMIN` sends a full config body including template ids and `slotBindings` to `PUT /admin/tenants/:tenantId/outreach-config`
- **THEN** the config is created or replaced for that tenant and returned including those fields

#### Scenario: Toggle enabled
- **WHEN** `SUPER_ADMIN` patches `{ enabled: true }` on a tenant that has `phone` set and `active` true and remaining required fields already present including approved templates and complete bindings
- **THEN** `outreachConfig.enabled` becomes true

#### Scenario: PUT without template ids rejected
- **WHEN** `SUPER_ADMIN` PUTs an outreach config omitting `outreachTemplateId`
- **THEN** the API responds with HTTP 400

#### Scenario: Legacy fields rejected
- **WHEN** `SUPER_ADMIN` PUTs a body containing `outreachContactText`
- **THEN** the API responds with HTTP 400

#### Scenario: Patch send knobs
- **WHEN** `SUPER_ADMIN` patches `{ leadsPerRun: 10, sendIntervalSeconds: 5 }`
- **THEN** those two fields MUST be persisted and returned on a subsequent GET

### Requirement: Enabling outreach validates tenant readiness
The system SHALL reject enabling outreach (`enabled=true`) when the tenant has no usable `phone`, when `Tenant.active` is false, when either catalog template is missing or not `APPROVED`, or when required slot bindings are incomplete.

#### Scenario: Enable without phone rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true for a tenant with null or empty `phone`
- **THEN** the API responds with HTTP 400 and leaves enabled false (or does not persist enabled true)

#### Scenario: Enable on inactive tenant rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true for a tenant with `active` false
- **THEN** the API responds with HTTP 400

#### Scenario: Enable without approved template rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true and the outreach catalog template status is not `APPROVED`
- **THEN** the API responds with HTTP 400

### Requirement: Super admin manages platform WhatsApp accounts
The system SHALL allow a `SUPER_ADMIN` to list, create, and update WhatsApp accounts belonging to the platform (`tenantId` null). Create and update MUST accept `wabaId`. The API MUST NOT accept or return the Meta access token value—only `tokenEnvKey` and non-secret fields (`phoneNumberId`, `wabaId`, `displayPhone`, `enabled`, `provider`).

#### Scenario: Create platform account
- **WHEN** `SUPER_ADMIN` posts `{ phoneNumberId, wabaId, tokenEnvKey, displayPhone }` to `POST /admin/whatsapp-accounts`
- **THEN** a `WhatsappAccount` is stored with `tenantId` null, `provider` Cloud API (or default), persisted `wabaId`, and the response does not include any access token secret

#### Scenario: Reject tenant-scoped account in MVP
- **WHEN** a create/update request attempts to set a non-null commercial `tenantId` on a WhatsApp account via admin API
- **THEN** the API responds with HTTP 400

#### Scenario: Update phone number id
- **WHEN** `SUPER_ADMIN` patches `phoneNumberId` on `PATCH /admin/whatsapp-accounts/:id`
- **THEN** subsequent platform sends by notifly resolving credentials use the updated id from the database (no code deploy)

#### Scenario: Update waba id
- **WHEN** `SUPER_ADMIN` patches `wabaId` on the platform account
- **THEN** the next template sync MUST call Graph using that WABA id

### Requirement: Super admin manages scrape targets
The system SHALL allow a `SUPER_ADMIN` to list, create, update, and disable/delete scrape targets. Creating a target MUST accept a city name (creating the `City` if needed) and a category string, and MUST upsert on `(cityId, category)`. The API MUST NOT launch Puppeteer as a synchronous side effect of the write.

#### Scenario: Create target for new city
- **WHEN** `SUPER_ADMIN` posts `{ cityName: "Taubaté", state: "SP", category: "Construtoras", enabled: true }` to `POST /admin/scrape-targets`
- **THEN** a `City` for Taubaté MUST exist if it did not, a `ScrapeTarget` for that city and category MUST be enabled, and the response MUST include the target id

#### Scenario: Duplicate target is upserted
- **WHEN** a target for the same city and category already exists and `SUPER_ADMIN` posts the same pair
- **THEN** the API MUST NOT create a second row and MUST return the existing target (updated `enabled` if sent)

#### Scenario: Disable target
- **WHEN** `SUPER_ADMIN` patches `{ enabled: false }` on `PATCH /admin/scrape-targets/:id`
- **THEN** subsequent captura crons MUST skip that pair

### Requirement: Super admin can read scrape coverage
The system SHALL allow a `SUPER_ADMIN` to list scrape coverage rows (city, category, first/last run, status, last lead count). The API MUST be read-only for coverage in this change.

#### Scenario: List coverage
- **WHEN** `SUPER_ADMIN` calls `GET /admin/scrape-coverages`
- **THEN** the response MUST include persisted coverage rows without requiring a code deploy
