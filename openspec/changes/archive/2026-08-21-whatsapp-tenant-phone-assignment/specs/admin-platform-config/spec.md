## ADDED Requirements

### Requirement: Super admin assigns WhatsApp phone to tenant outreach config
The system SHALL treat `whatsappAccountId` as a platform-owned field of `TenantOutreachConfig`. `SUPER_ADMIN` MUST be able to PATCH it at any time under `/platform/tenants/:tenantId/outreach-config` together with price fields. The value MUST be null (default sender) or the id of an enabled non-default platform `WhatsappAccount` not assigned to another tenant. Tenant-owned field rules are otherwise unchanged.

#### Scenario: Super admin patches assignment after window
- **WHEN** outreach config `createdAt` is older than 30 minutes and `SUPER_ADMIN` patches `{ whatsappAccountId: 2 }` with a valid dedicated account
- **THEN** `whatsappAccountId` is persisted

#### Scenario: Super admin patches assignment together with price
- **WHEN** `SUPER_ADMIN` patches `{ costPerLead: 0.5, whatsappAccountId: null }`
- **THEN** both fields are persisted

## MODIFIED Requirements

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
