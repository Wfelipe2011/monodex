# admin-platform-config Specification

## Purpose

Super-admin API to manage `TenantOutreachConfig` and platform `WhatsappAccount` (no Meta token storage).
## Requirements
### Requirement: Super admin manages tenant outreach config
The system SHALL allow a `SUPER_ADMIN` to GET `TenantOutreachConfig` and to PATCH platform-owned fields `costPerLead`, `cashbackOnReply`, and `whatsappAccountId` at any time under `/platform/tenants/:tenantId/outreach-config`. Super Admin MUST NOT persist tenant-owned fields (`enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, `notifyTemplateId`) except when creating a missing config or within 30 minutes of that config's `createdAt`. PUT of a missing config MAY include tenant-owned fields (bootstrap) and MAY include `whatsappAccountId`. The API MUST reject bodies that include `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, or `headerImageUrl`.

#### Scenario: Super admin patches price after window
- **WHEN** outreach config `createdAt` is older than 30 minutes and `SUPER_ADMIN` patches `{ costPerLead: 0.5 }`
- **THEN** `costPerLead` is persisted

#### Scenario: Super admin cannot patch knobs after window
- **WHEN** outreach config `createdAt` is older than 30 minutes and `SUPER_ADMIN` patches `{ leadsPerRun: 10 }`
- **THEN** the API responds with HTTP 403

#### Scenario: Legacy fields rejected
- **WHEN** `SUPER_ADMIN` PUTs a body containing `outreachContactText`
- **THEN** the API responds with HTTP 400

#### Scenario: Bootstrap create allowed
- **WHEN** no outreach config exists and `SUPER_ADMIN` PUTs a full body including tenant-owned fields
- **THEN** the config is created for that tenant

### Requirement: Enabling outreach validates tenant readiness
The system SHALL reject enabling outreach (`enabled=true`) when the tenant has no usable `phone`, when `Tenant.active` is false, when either catalog template is missing or not `APPROVED`, when a template id is not granted to the tenant, or when required slot bindings are incomplete. Enable writes are tenant-owned (`ADMIN`, or Super Admin only inside the bootstrap window).

#### Scenario: Enable without phone rejected
- **WHEN** `ADMIN` sets `enabled` true for a tenant with null or empty `phone`
- **THEN** the API responds with HTTP 400 and leaves enabled false (or does not persist enabled true)

#### Scenario: Enable on inactive tenant rejected
- **WHEN** `ADMIN` sets `enabled` true for a tenant with `active` false
- **THEN** the API responds with HTTP 400 or 403 according to the inactive-tenant consultative lock, and enabled MUST NOT become true

#### Scenario: Enable without approved template rejected
- **WHEN** `ADMIN` sets `enabled` true and the outreach catalog template status is not `APPROVED`
- **THEN** the API responds with HTTP 400

### Requirement: Super admin manages platform WhatsApp accounts
The system SHALL allow a `SUPER_ADMIN` to list, create, and update WhatsApp accounts belonging to the platform (`tenantId` null) under `/platform/whatsapp-accounts`. Create and update MUST accept `wabaId` and MAY accept `isDefault`. Listed accounts MUST include every platform row, not only the default. Create and update MUST reject a `wabaId` that differs from the existing default account's `wabaId` when a default already exists. The API MUST NOT accept or return the Meta access token value—only `tokenEnvKey` and non-secret fields (`phoneNumberId`, `wabaId`, `displayPhone`, `enabled`, `provider`, `isDefault`). Promoting `isDefault` true MUST unset the previous default in the same transaction. Disabling the current default account MUST be rejected.

#### Scenario: Create platform account
- **WHEN** `SUPER_ADMIN` posts `{ phoneNumberId, wabaId, tokenEnvKey, displayPhone }` to `POST /platform/whatsapp-accounts` and a default already exists with the same `wabaId`
- **THEN** a `WhatsappAccount` is stored with `tenantId` null, `provider` Cloud API (or default), persisted `wabaId`, `isDefault` false unless it is the first platform account, and the response does not include any access token secret

#### Scenario: Reject tenant-scoped account in MVP
- **WHEN** a create/update request attempts to set a non-null commercial `tenantId` on a WhatsApp account via platform API
- **THEN** the API responds with HTTP 400

#### Scenario: Update phone number id
- **WHEN** `SUPER_ADMIN` patches `phoneNumberId` on `PATCH /platform/whatsapp-accounts/:id`
- **THEN** subsequent sends that resolve to that account MUST use the updated id from the database (no code deploy)

#### Scenario: Update waba id
- **WHEN** `SUPER_ADMIN` patches `wabaId` on the platform account to a value equal to the fleet `wabaId`
- **THEN** the next template sync MUST call Graph using the default account's `wabaId`

#### Scenario: Promote default
- **WHEN** account B is enabled, unassigned, and Super Admin patches `{ isDefault: true }` on B while account A was default
- **THEN** B is default and A has `isDefault` false

#### Scenario: Disable default rejected
- **WHEN** Super Admin patches `{ enabled: false }` on the current default account
- **THEN** the API responds with HTTP 400 and the account remains enabled

### Requirement: Super admin manages scrape targets
The system SHALL allow a `SUPER_ADMIN` to list, create, update, and disable/delete scrape targets under `/platform/scrape-targets`. Creating a target MUST accept a city name (creating the `City` if needed) and a category string, and MUST upsert on `(cityId, category)`. The API MUST NOT launch Puppeteer as a synchronous side effect of the write. Super Admin list MUST include all targets, not only tenant-linked ones.

#### Scenario: Create target for new city
- **WHEN** `SUPER_ADMIN` posts `{ cityName: "Taubaté", state: "SP", category: "Construtoras", enabled: true }` to `POST /platform/scrape-targets`
- **THEN** a `City` for Taubaté MUST exist if it did not, a `ScrapeTarget` for that city and category MUST be enabled, and the response MUST include the target id

#### Scenario: Duplicate target is upserted
- **WHEN** a target for the same city and category already exists and `SUPER_ADMIN` posts the same pair
- **THEN** the API MUST NOT create a second row and MUST return the existing target (updated `enabled` if sent)

#### Scenario: Disable target
- **WHEN** `SUPER_ADMIN` patches `{ enabled: false }` on `PATCH /platform/scrape-targets/:id`
- **THEN** subsequent captura crons MUST skip that pair

### Requirement: Super admin can read scrape coverage
The system SHALL allow a `SUPER_ADMIN` to list scrape coverage rows (city, category, first/last run, status, last lead count) at `GET /platform/scrape-coverages`. The API MUST be read-only for coverage in this change.

#### Scenario: List coverage
- **WHEN** `SUPER_ADMIN` calls `GET /platform/scrape-coverages`
- **THEN** the response MUST include persisted coverage rows without requiring a code deploy

### Requirement: Tenant admin patches operational outreach fields
The system SHALL allow an active tenant `ADMIN` to GET and PATCH tenant-owned outreach fields on `/tenant/:tenantId/outreach-config`. Bodies that include `costPerLead`, `cashbackOnReply`, or `whatsappAccountId` MUST be rejected with HTTP 403. Admin MAY PUT a missing config with tenant-owned fields; omitted platform prices MUST default so sends do not run until Super Admin sets a positive `costPerLead`; omitted `whatsappAccountId` MUST be stored as null (default sender). GET MUST include `whatsappAccountId` and the resolved WhatsApp account summary as read-only.

#### Scenario: Admin patches knobs
- **WHEN** `ADMIN` of tenant 4 patches `{ leadsPerRun: 10, sendIntervalSeconds: 5 }`
- **THEN** those two fields MUST be persisted and returned on a subsequent GET

#### Scenario: Admin cannot patch price
- **WHEN** `ADMIN` patches `{ costPerLead: 0.01 }`
- **THEN** the API responds with HTTP 403

#### Scenario: Admin GET includes read-only price
- **WHEN** `ADMIN` GETs outreach config that has `costPerLead` 0.35
- **THEN** the response includes `costPerLead` 0.35

#### Scenario: Admin cannot patch WhatsApp assignment
- **WHEN** `ADMIN` patches `{ whatsappAccountId: 2 }`
- **THEN** the API responds with HTTP 403

### Requirement: Super admin assigns WhatsApp phone to tenant outreach config
The system SHALL treat `whatsappAccountId` as a platform-owned field of `TenantOutreachConfig`. `SUPER_ADMIN` MUST be able to PATCH it at any time under `/platform/tenants/:tenantId/outreach-config` together with price fields. The value MUST be null (default sender) or the id of an enabled non-default platform `WhatsappAccount` not assigned to another tenant. Tenant-owned field rules are otherwise unchanged.

#### Scenario: Super admin patches assignment after window
- **WHEN** outreach config `createdAt` is older than 30 minutes and `SUPER_ADMIN` patches `{ whatsappAccountId: 2 }` with a valid dedicated account
- **THEN** `whatsappAccountId` is persisted

#### Scenario: Super admin patches assignment together with price
- **WHEN** `SUPER_ADMIN` patches `{ costPerLead: 0.5, whatsappAccountId: null }`
- **THEN** both fields are persisted

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

