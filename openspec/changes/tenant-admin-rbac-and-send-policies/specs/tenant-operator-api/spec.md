## ADDED Requirements

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
