## MODIFIED Requirements

### Requirement: Admin routes require SUPER_ADMIN
The system SHALL reject requests to `/platform/*` routes unless the request presents a valid JWT whose `roles` include `SUPER_ADMIN`. Tenant `ADMIN` callers MUST receive HTTP 403 on `/platform/*`. Documented gym-ctrl platform routes MUST use the `/platform` prefix rather than `/admin`.

#### Scenario: Tenant ADMIN forbidden
- **WHEN** a user whose roles are only `ADMIN` (tenant) calls any `/platform/*` endpoint with a valid JWT
- **THEN** the API responds with HTTP 403

#### Scenario: Unauthenticated forbidden
- **WHEN** a client calls any `/platform/*` endpoint without a valid Bearer token
- **THEN** the API responds with HTTP 401

#### Scenario: Super admin allowed
- **WHEN** a `SUPER_ADMIN` calls a `/platform/*` endpoint with a valid JWT
- **THEN** the request is authorized by the roles guard (subject to resource validation)
