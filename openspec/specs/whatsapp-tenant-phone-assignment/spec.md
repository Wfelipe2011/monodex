# whatsapp-tenant-phone-assignment Specification

## Purpose
TBD - created by archiving change whatsapp-tenant-phone-assignment. Update Purpose after archive.
## Requirements
### Requirement: Platform numbers share one WABA with an explicit default
The system SHALL persist one or more platform `WhatsappAccount` rows (`tenantId` null, `provider` Cloud API) that share a single `wabaId`. Exactly one enabled platform account MUST be the default sender (`isDefault` true). Each `phoneNumberId` MUST be unique. The access token MUST remain in the environment named by `tokenEnvKey` and MUST NOT be stored on the account row.

#### Scenario: Second number on same WABA
- **WHEN** a default platform account exists with `wabaId` `W` and Super Admin creates another account with a distinct `phoneNumberId` and `wabaId` `W`
- **THEN** the new row is stored with `tenantId` null, `isDefault` false, and the previous default remains default

#### Scenario: Divergent WABA rejected
- **WHEN** a default platform account exists with `wabaId` `W` and Super Admin creates or patches an account with `wabaId` `Z` where `Z` ≠ `W`
- **THEN** the API responds with HTTP 400 and MUST NOT persist the divergent `wabaId`

#### Scenario: Resolve without tenant uses default
- **WHEN** the system resolves Cloud API credentials without a tenant id
- **THEN** it MUST use the enabled default account's `phoneNumberId` and MUST read the token from that account's `tokenEnvKey`

#### Scenario: Resolve with dedicated assignment
- **WHEN** tenant T has `TenantOutreachConfig.whatsappAccountId` pointing at enabled non-default account A and the system sends for tenant T
- **THEN** the Graph messages URL MUST use account A's `phoneNumberId`

#### Scenario: Resolve with null assignment uses default
- **WHEN** tenant T has outreach config with `whatsappAccountId` null (or no config) and the system sends for tenant T
- **THEN** the Graph messages URL MUST use the default account's `phoneNumberId`

#### Scenario: Disabled dedicated assignment does not fall back
- **WHEN** tenant T is assigned to account A and A is `enabled=false`
- **THEN** resolving credentials for tenant T MUST fail and MUST NOT send via the default account

### Requirement: Dedicated phone assignment is exclusive and Super-Admin owned
The system SHALL allow a `SUPER_ADMIN` to set or clear `TenantOutreachConfig.whatsappAccountId`. A non-null value MUST reference an enabled, non-default platform account that is not assigned to another tenant. Clearing the field (null) MUST return that tenant to the default sender. Tenant `ADMIN` MUST NOT persist `whatsappAccountId`. GET of outreach config MUST include `whatsappAccountId` and the resolved account summary (`id`, `phoneNumberId`, `displayPhone`, `isDefault`) for authorized callers.

#### Scenario: Super admin assigns dedicated number
- **WHEN** `SUPER_ADMIN` patches `{ whatsappAccountId: A }` on `/platform/tenants/:tenantId/outreach-config` and A is enabled, not default, and unassigned
- **THEN** the config stores A and subsequent sends for that tenant use A's `phoneNumberId`

#### Scenario: Super admin unassigns to default
- **WHEN** `SUPER_ADMIN` patches `{ whatsappAccountId: null }` for a tenant that had a dedicated account
- **THEN** the config stores null and subsequent sends for that tenant use the default `phoneNumberId`

#### Scenario: Assign default account id rejected
- **WHEN** `SUPER_ADMIN` patches `whatsappAccountId` equal to the default account's id
- **THEN** the API responds with HTTP 400 and the assignment is unchanged

#### Scenario: Assign number already used by another tenant rejected
- **WHEN** tenant X already has `whatsappAccountId` A and Super Admin patches tenant Y with `whatsappAccountId` A
- **THEN** the API responds with HTTP 400 and tenant Y is unchanged

#### Scenario: Tenant admin cannot assign
- **WHEN** `ADMIN` patches `{ whatsappAccountId: A }` on `/tenant/:tenantId/outreach-config`
- **THEN** the API responds with HTTP 403 and the assignment is unchanged

#### Scenario: GET shows resolved default
- **WHEN** `ADMIN` GETs outreach config with `whatsappAccountId` null
- **THEN** the response includes `whatsappAccountId` null and a resolved account object with `isDefault` true

### Requirement: Inbound without context on a dedicated number maps to that tenant
When a webhook inbound message has no usable `context.id` correlation, the system SHALL look up `metadata.phone_number_id` against platform accounts. If that account is assigned to exactly one tenant (non-default dedicated), the message MUST be persisted with that `tenantId`. If the account is the shared default or unknown, the system MUST NOT invent a tenant.

#### Scenario: Dedicated number inbound without context
- **WHEN** inbound has no `context.id` and `phone_number_id` matches account A assigned to tenant T
- **THEN** a conversation message is persisted with `tenantId` T

#### Scenario: Default number inbound without context stays unmapped
- **WHEN** inbound has no `context.id` and `phone_number_id` matches the default account
- **THEN** the system MUST NOT persist a conversation message attributed to an arbitrary tenant

