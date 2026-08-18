## MODIFIED Requirements

### Requirement: Super admin manages tenants
The system SHALL allow a `SUPER_ADMIN` to create, list, retrieve, and update tenants under `/platform/tenants`, including an `active` boolean flag (default true). Hard delete of tenants is out of scope. Setting `active` false MUST make tenant APIs consultative-only as specified by `tenant-operator-api`.

#### Scenario: Create tenant
- **WHEN** `SUPER_ADMIN` posts `{ name, phone }` to `POST /platform/tenants`
- **THEN** a tenant is persisted with generated `uuid`, `active` true by default, and returned in the response without requiring SQL

#### Scenario: Deactivate tenant
- **WHEN** `SUPER_ADMIN` patches `{ active: false }` on `PATCH /platform/tenants/:id`
- **THEN** subsequent reads show `active` false for that tenant

#### Scenario: List tenants
- **WHEN** `SUPER_ADMIN` calls `GET /platform/tenants`
- **THEN** the API returns tenants (including `id`, `name`, `phone`, `uuid`, `active`)

### Requirement: Super admin manages tenant users
The system SHALL allow a `SUPER_ADMIN` to list users of a tenant and to create the **first** tenant user (default role `ADMIN`) when the tenant has zero users, via `/platform/tenants/:tenantId/users`. Super Admin MUST NOT update users, reset passwords, or create additional users. Creating or promoting a user to `SUPER_ADMIN` via tenant-user endpoints MUST be rejected.

#### Scenario: Create first tenant admin
- **WHEN** tenant 4 has no users and `SUPER_ADMIN` posts name, username, email, and password to `POST /platform/tenants/:tenantId/users`
- **THEN** a user is created for that tenant with hashed password and roles including `ADMIN`, and the password hash is not returned

#### Scenario: Second user by super admin rejected
- **WHEN** tenant 4 already has a user and `SUPER_ADMIN` posts another user
- **THEN** the API responds with HTTP 403

#### Scenario: Promote to SUPER_ADMIN rejected
- **WHEN** `SUPER_ADMIN` or `ADMIN` attempts to set roles including `SUPER_ADMIN` on a tenant-user create or patch endpoint
- **THEN** the API responds with HTTP 400

### Requirement: Super admin manages coin balances
The system SHALL allow a `SUPER_ADMIN` to view coin balances for a tenant, credit and debit a specific `userId`, and list recent coin transactions under `/platform/tenants/:tenantId`. Each credit or debit MUST create a `CoinTransaction` row. Tenant `ADMIN` MUST be allowed to GET balances and transactions for their tenant and MUST NOT credit or debit.

#### Scenario: Credit wallet
- **WHEN** `SUPER_ADMIN` posts `{ userId, amount, description }` to `POST /platform/tenants/:tenantId/coins/credit` with amount > 0
- **THEN** the user's coin balance for that tenant increases by amount and a `CoinTransaction` of type `CREDITO` or `BONUS` is recorded

#### Scenario: Debit wallet
- **WHEN** `SUPER_ADMIN` posts `{ userId, amount, description }` to `POST /platform/tenants/:tenantId/coins/debit` with amount > 0 and sufficient balance
- **THEN** the balance decreases and a `CoinTransaction` of type `DEBITO` is recorded

#### Scenario: Insufficient balance on debit
- **WHEN** debit amount exceeds current balance
- **THEN** the API responds with HTTP 400 and does not change balance

#### Scenario: Admin cannot credit
- **WHEN** tenant `ADMIN` posts a coin credit
- **THEN** the API responds with HTTP 403

## ADDED Requirements

### Requirement: Tenant admin manages subsequent users
The system SHALL allow an active tenant `ADMIN` to list, create, update allowed fields, and reset password for users of their own tenant under `/tenant/:tenantId/users`. Super Admin GET of the same list MUST be allowed. Password hashes MUST NOT be returned.

#### Scenario: Admin creates teammate
- **WHEN** `ADMIN` of tenant 4 posts a new user with roles `[ADMIN]` or `[USER]`
- **THEN** the user is created for tenant 4

#### Scenario: Admin resets password
- **WHEN** `ADMIN` of tenant 4 posts a new password to the tenant reset-password endpoint
- **THEN** the target user can authenticate with the new password via `/auth/login`
