# tenant-operator-api Specification

## Purpose

Split gym-ctrl operator APIs into `/platform/*` (Super Admin) and `/tenant/:tenantId/*` (tenant Admin), including scope, inactive-tenant consultative lock, bootstrap write window, and shared `Tenant.phone` updates.
## Requirements
### Requirement: Platform and tenant API prefixes are distinct
The system SHALL expose platform operator APIs under `/platform/*` and tenant operator APIs under `/tenant/:tenantId/*`. Former `/admin/*` gym-ctrl routes for these resources MUST NOT remain the documented contract. Push subscription routes SHALL live at `/tenant/push-subscriptions` without a tenant id param (authenticated user from JWT).

#### Scenario: Super admin uses platform prefix
- **WHEN** `SUPER_ADMIN` lists tenants
- **THEN** the request MUST succeed on `GET /platform/tenants` and MUST NOT require `/admin/tenants`

#### Scenario: Tenant admin uses tenant prefix
- **WHEN** an `ADMIN` of tenant 4 gets outreach config
- **THEN** the request MUST succeed on `GET /tenant/4/outreach-config` given a valid JWT for tenant 4

### Requirement: Tenant admin cannot call platform routes
The system SHALL reject requests to `/platform/*` unless the JWT `roles` include `SUPER_ADMIN`.

#### Scenario: Tenant admin forbidden on platform
- **WHEN** a user whose roles are only `ADMIN` calls `GET /platform/tenants` with a valid JWT
- **THEN** the API responds with HTTP 403

#### Scenario: Unauthenticated platform forbidden
- **WHEN** a client calls `/platform/tenants` without a Bearer token
- **THEN** the API responds with HTTP 401

### Requirement: Tenant routes are scoped to jwt tenant for ADMIN
The system SHALL reject `/tenant/:tenantId/*` writes and reads by `ADMIN` when `tenantId` is not the JWT `tenantId`. `SUPER_ADMIN` MAY read any `:tenantId` on `/tenant/*`. `USER` MUST be treated like `ADMIN` for scope (own tenant only) unless a more specific role decorator forbids the route.

#### Scenario: Admin cannot access another tenant
- **WHEN** an `ADMIN` with JWT `tenantId=4` calls `GET /tenant/9/outreach-config`
- **THEN** the API responds with HTTP 403

#### Scenario: Super admin can GET another tenant operational config
- **WHEN** `SUPER_ADMIN` calls `GET /tenant/4/outreach-config`
- **THEN** the API responds with HTTP 200 or 404 according to whether the config exists, not 403 for role/scope

### Requirement: Super admin cannot write tenant-owned actions except bootstrap
The system SHALL forbid `SUPER_ADMIN` from persisting tenant-owned fields or performing tenant-owned mutating actions on `/tenant/*` except: (1) creating a tenant-owned resource that does not exist, or (2) mutating that resource while `now - createdAt` is less than 30 minutes. After the window, Super Admin writes that include tenant-owned fields MUST return HTTP 403. Super Admin MUST NOT create a second tenant user; first user creation is a platform action.

#### Scenario: Super admin creates missing outreach config
- **WHEN** tenant 4 has no `TenantOutreachConfig` and `SUPER_ADMIN` PUTs a body including tenant-owned fields to create it
- **THEN** the row is persisted

#### Scenario: Super admin edits tenant fields inside 30 minutes
- **WHEN** the outreach config was created 10 minutes ago and `SUPER_ADMIN` patches `{ leadsPerRun: 8 }`
- **THEN** `leadsPerRun` is persisted

#### Scenario: Super admin blocked after window
- **WHEN** the outreach config was created 31 minutes ago and `SUPER_ADMIN` patches `{ leadsPerRun: 8 }`
- **THEN** the API responds with HTTP 403 and `leadsPerRun` is unchanged

#### Scenario: Super admin cannot create second user
- **WHEN** tenant 4 already has one user and `SUPER_ADMIN` POSTs another user
- **THEN** the API responds with HTTP 403

### Requirement: Inactive tenant is consultative only on tenant APIs
When `Tenant.active` is false, the system SHALL allow GET (and equivalent read) requests on `/tenant/:tenantId/*` for authorized callers and SHALL reject non-read methods with HTTP 403. City outreach and list-campaign crons MUST skip that tenant. Platform `/platform/*` writes (price, coins, policies, `active`, WhatsApp) MUST still be allowed for `SUPER_ADMIN`.

#### Scenario: Inactive admin cannot create a list
- **WHEN** tenant 4 has `active=false` and its `ADMIN` POSTs a lead list
- **THEN** the API responds with HTTP 403

#### Scenario: Inactive admin can GET outreach config
- **WHEN** tenant 4 has `active=false` and its `ADMIN` GETs outreach config
- **THEN** the API responds with HTTP 200 or 404, not 403 for inactivity

#### Scenario: Cron skips inactive tenant
- **WHEN** tenant 4 has `active=false` and outreach `enabled=true` with a matching schedule
- **THEN** notifly MUST NOT send city outreach or list campaign messages for tenant 4

### Requirement: Both roles may update tenant phone
The system SHALL allow `SUPER_ADMIN` to patch `Tenant.phone` via `/platform/tenants/:id` and SHALL allow the tenant `ADMIN` to patch `Tenant.phone` via `/tenant/:tenantId` when the tenant is active.

#### Scenario: Admin updates phone
- **WHEN** an active tenant's `ADMIN` patches `{ phone: "12911112222" }` on the tenant phone endpoint
- **THEN** `Tenant.phone` is persisted

#### Scenario: Super admin updates phone
- **WHEN** `SUPER_ADMIN` patches `{ phone: "12911112222" }` on `PATCH /platform/tenants/:id`
- **THEN** `Tenant.phone` is persisted

### Requirement: First-admin invite is a platform action
The system SHALL treat issuing, listing, and revoking `FIRST_ADMIN` invites as `/platform/tenants/:tenantId/invites` operations for `SUPER_ADMIN`. Super Admin MUST NOT create a second tenant user via invite; `FIRST_ADMIN` accept MUST fail when the tenant already has users.

#### Scenario: Super admin issues first-admin invite on platform prefix
- **WHEN** `SUPER_ADMIN` posts to `POST /platform/tenants/4/invites` for a tenant with zero users
- **THEN** the request MUST succeed on the platform prefix and MUST NOT require `/tenant/4/invites`

### Requirement: Tenant-user invite is tenant-owned
The system SHALL reject `SUPER_ADMIN` writes that issue or revoke `TENANT_USER` invites on `/tenant/:tenantId/invites` with HTTP 403. Tenant `ADMIN` of that `tenantId` MUST be allowed to issue and revoke those invites when the tenant is active.

#### Scenario: Super admin cannot issue tenant-user invite
- **WHEN** `SUPER_ADMIN` posts to `POST /tenant/4/invites`
- **THEN** the API responds with HTTP 403

#### Scenario: Admin of another tenant cannot issue
- **WHEN** an `ADMIN` with JWT `tenantId=9` posts to `POST /tenant/4/invites`
- **THEN** the API responds with HTTP 403

### Requirement: Public invite routes do not use tenant JWT
The system SHALL allow `GET /public/invites/:token` and `POST /public/invites/:token/accept` without a Bearer token. These routes MUST NOT be documented as `/platform` or `/tenant` operator APIs.

#### Scenario: Unauthenticated preview
- **WHEN** a client GETs `/public/invites/:token` without Authorization
- **THEN** the request is not rejected with HTTP 401 solely for missing JWT (it MAY still be 404 if the token is invalid)

### Requirement: Allowlisted tenant routes accept X-API-KEY or JWT
The system SHALL accept either `Authorization: Bearer` JWT or header `X-API-KEY` on the allowlisted `/tenant/:tenantId/*` routes defined by on-demand send, conversations, media (authenticated), schedules, and granted-template list. Presenting both credentials together MUST return HTTP 400. A valid API key on a non-allowlisted route, including all `/platform/*` routes and `/tenant/:tenantId/api-keys`, MUST return HTTP 401. `@Public()` routes MUST continue to work without either credential.

#### Scenario: API key on conversations list
- **WHEN** a valid API key for tenant 4 GETs `/tenant/4/conversations`
- **THEN** the API responds HTTP 200 with that tenant's threads

#### Scenario: API key on platform rejected
- **WHEN** a valid API key GETs `/platform/tenants`
- **THEN** the API responds with HTTP 401

#### Scenario: Both credentials rejected
- **WHEN** a request includes Bearer JWT and `X-API-KEY`
- **THEN** the API responds with HTTP 400

#### Scenario: Key on coins rejected
- **WHEN** a valid API key POSTs `/tenant/4/coins/debit` or equivalent coin write
- **THEN** the API responds with HTTP 401

### Requirement: API-key principal is scoped like tenant Admin
When authenticated via API key, `TenantScopeGuard` MUST treat `tenantId` from the key the same way as JWT `ADMIN` (own tenant only). Super Admin JWT behavior on `/tenant/*` (read any tenant, no pontapé writes on this channel) is unchanged.

#### Scenario: Key cannot access another tenant
- **WHEN** an API key issued for tenant 4 GETs `/tenant/9/conversations`
- **THEN** the API responds with HTTP 403

