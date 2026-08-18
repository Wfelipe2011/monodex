# super-admin-identity Specification

## Purpose

Platform operator identity via `SUPER_ADMIN` role on `User`, bootstrap seed, and authorization for `/platform/*` routes in gym-ctrl.

## Requirements

### Requirement: Role SUPER_ADMIN exists in the identity model
The system SHALL include `SUPER_ADMIN` in the Prisma `Roles` enum used by `User.roles`.

#### Scenario: Enum includes platform role
- **WHEN** the Prisma schema is inspected after migration
- **THEN** `Roles` contains `ADMIN`, `USER`, and `SUPER_ADMIN`

### Requirement: Platform tenant and bootstrap super admin
The system SHALL provide an idempotent bootstrap that ensures a platform tenant and at least one user with `SUPER_ADMIN` exist, using credentials from environment (or documented development defaults).

#### Scenario: Fresh bootstrap
- **WHEN** the platform bootstrap seed runs on a database without a platform admin
- **THEN** a platform tenant is created or reused and a user with `roles` containing `SUPER_ADMIN` is created with hashed password

#### Scenario: Idempotent re-run
- **WHEN** the platform bootstrap seed runs again
- **THEN** it does not create duplicate platform tenants or duplicate platform admin users for the same email

### Requirement: Existing login issues JWT with SUPER_ADMIN
The system SHALL allow the platform admin to authenticate via the existing `POST /auth/login` endpoint and receive a JWT whose `roles` include `SUPER_ADMIN`.

#### Scenario: Platform admin login
- **WHEN** a client posts valid platform admin email and password to `/auth/login`
- **THEN** the response includes a JWT containing `roles` that include `SUPER_ADMIN` and a `tenantId` of the platform tenant

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
