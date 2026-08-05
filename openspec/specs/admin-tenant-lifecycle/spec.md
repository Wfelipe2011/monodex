# admin-tenant-lifecycle Specification

## Purpose

Super-admin API for creating and managing tenants, tenant users, and coin balances without SQL.

## Requirements

### Requirement: Super admin manages tenants
The system SHALL allow a `SUPER_ADMIN` to create, list, retrieve, and update tenants, including an `active` boolean flag (default true). Hard delete of tenants is out of scope.

#### Scenario: Create tenant
- **WHEN** `SUPER_ADMIN` posts `{ name, phone }` to `POST /admin/tenants`
- **THEN** a tenant is persisted with generated `uuid`, `active` true by default, and returned in the response without requiring SQL

#### Scenario: Deactivate tenant
- **WHEN** `SUPER_ADMIN` patches `{ active: false }` on `PATCH /admin/tenants/:id`
- **THEN** subsequent reads show `active` false for that tenant

#### Scenario: List tenants
- **WHEN** `SUPER_ADMIN` calls `GET /admin/tenants`
- **THEN** the API returns tenants (including `id`, `name`, `phone`, `uuid`, `active`)

### Requirement: Super admin manages tenant users
The system SHALL allow a `SUPER_ADMIN` to list users of a tenant, create a tenant user (default role `ADMIN`), update allowed fields, and reset password. Creating or promoting a user to `SUPER_ADMIN` via tenant-user endpoints MUST be rejected.

#### Scenario: Create tenant admin
- **WHEN** `SUPER_ADMIN` posts name, username, email, and password to `POST /admin/tenants/:tenantId/users`
- **THEN** a user is created for that tenant with hashed password and roles including `ADMIN`, and the password hash is not returned

#### Scenario: Reset password
- **WHEN** `SUPER_ADMIN` posts a new password to `POST /admin/tenants/:tenantId/users/:userId/reset-password`
- **THEN** the user can authenticate with the new password via `/auth/login`

#### Scenario: Promote to SUPER_ADMIN rejected
- **WHEN** `SUPER_ADMIN` attempts to set roles including `SUPER_ADMIN` on a tenant-user create or patch endpoint
- **THEN** the API responds with HTTP 400

### Requirement: Super admin manages coin balances
The system SHALL allow a `SUPER_ADMIN` to view coin balances for a tenant, credit and debit a specific `userId`, and list recent coin transactions. Each credit or debit MUST create a `CoinTransaction` row.

#### Scenario: Credit wallet
- **WHEN** `SUPER_ADMIN` posts `{ userId, amount, description }` to `POST /admin/tenants/:tenantId/coins/credit` with amount > 0
- **THEN** the user's coin balance for that tenant increases by amount and a `CoinTransaction` of type `CREDITO` or `BONUS` is recorded

#### Scenario: Debit wallet
- **WHEN** `SUPER_ADMIN` posts `{ userId, amount, description }` to `POST /admin/tenants/:tenantId/coins/debit` with amount > 0 and sufficient balance
- **THEN** the balance decreases and a `CoinTransaction` of type `DEBITO` is recorded

#### Scenario: Insufficient balance on debit
- **WHEN** debit amount exceeds current balance
- **THEN** the API responds with HTTP 400 and does not change balance
