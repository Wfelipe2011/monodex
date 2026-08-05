# admin-platform-config Specification

## Purpose

Super-admin API to manage `TenantOutreachConfig` and platform `WhatsappAccount` (no Meta token storage).

## Requirements

### Requirement: Super admin manages tenant outreach config
The system SHALL allow a `SUPER_ADMIN` to get, put (upsert), and patch `TenantOutreachConfig` for a tenant, including `enabled`, `costPerLead`, `cashbackOnReply`, `outreachTemplateName`, `notifyTenantTemplateName`, `schedule`, and `categories`.

#### Scenario: Upsert outreach config
- **WHEN** `SUPER_ADMIN` sends a full config body to `PUT /admin/tenants/:tenantId/outreach-config`
- **THEN** the config is created or replaced for that tenant and returned

#### Scenario: Toggle enabled
- **WHEN** `SUPER_ADMIN` patches `{ enabled: true }` on a tenant that has `phone` set and `active` true and remaining required fields already present
- **THEN** `outreachConfig.enabled` becomes true

### Requirement: Enabling outreach validates tenant readiness
The system SHALL reject enabling outreach (`enabled=true`) when the tenant has no usable `phone` or when `Tenant.active` is false.

#### Scenario: Enable without phone rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true for a tenant with null or empty `phone`
- **THEN** the API responds with HTTP 400 and leaves enabled false (or does not persist enabled true)

#### Scenario: Enable on inactive tenant rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true for a tenant with `active` false
- **THEN** the API responds with HTTP 400

### Requirement: Super admin manages platform WhatsApp accounts
The system SHALL allow a `SUPER_ADMIN` to list, create, and update WhatsApp accounts belonging to the platform (`tenantId` null). The API MUST NOT accept or return the Meta access token value—only `tokenEnvKey` and non-secret fields (`phoneNumberId`, `displayPhone`, `enabled`, `provider`).

#### Scenario: Create platform account
- **WHEN** `SUPER_ADMIN` posts `{ phoneNumberId, tokenEnvKey, displayPhone }` to `POST /admin/whatsapp-accounts`
- **THEN** a `WhatsappAccount` is stored with `tenantId` null and `provider` Cloud API (or default), and the response does not include any access token secret

#### Scenario: Reject tenant-scoped account in MVP
- **WHEN** a create/update request attempts to set a non-null commercial `tenantId` on a WhatsApp account via admin API
- **THEN** the API responds with HTTP 400

#### Scenario: Update phone number id
- **WHEN** `SUPER_ADMIN` patches `phoneNumberId` on `PATCH /admin/whatsapp-accounts/:id`
- **THEN** subsequent platform sends by notifly resolving credentials use the updated id from the database (no code deploy)
