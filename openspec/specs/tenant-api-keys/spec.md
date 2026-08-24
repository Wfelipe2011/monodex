# tenant-api-keys Specification

## Purpose

Super Admin grants per-tenant API access; tenant Admin creates, lists, and revokes up to three hashed keys that authenticate as that tenant's Admin via `X-API-KEY`.

## Requirements

### Requirement: Super Admin grants API access per tenant
The system SHALL persist `apiAccessEnabled` on `Tenant`, default false. Only `SUPER_ADMIN` MAY write this flag under `/platform/tenants/:id`. When the flag is false, the system MUST reject API-key authentication with HTTP 401 and MUST reject tenant Admin creation of new keys with HTTP 403.

#### Scenario: Default is off
- **WHEN** a tenant is created without an explicit `apiAccessEnabled`
- **THEN** `apiAccessEnabled` MUST be false and `X-API-KEY` authentication MUST fail

#### Scenario: Super Admin enables access
- **WHEN** `SUPER_ADMIN` patches `{ "apiAccessEnabled": true }` for tenant 4
- **THEN** tenant 4's Admin MAY create API keys subject to the active-key cap

#### Scenario: Admin cannot enable access
- **WHEN** tenant `ADMIN` patches `apiAccessEnabled`
- **THEN** the API responds with HTTP 403 and the flag is unchanged

#### Scenario: Disable invalidates keys immediately
- **WHEN** `SUPER_ADMIN` sets `apiAccessEnabled` false while tenant 4 still has unrevoked keys
- **THEN** subsequent requests with those keys MUST return HTTP 401

### Requirement: Tenant Admin manages up to three active API keys
The system SHALL allow the tenant `ADMIN` to create, list, and revoke API keys for their tenant under `/tenant/:tenantId/api-keys` when `apiAccessEnabled` is true and the tenant is active. At most three keys with `revokedAt` null MAY exist per tenant. A fourth create MUST be rejected with HTTP 409. Revoked keys MUST NOT count toward the cap. `SUPER_ADMIN` MAY GET the list and MUST NOT create or revoke. API-key authentication MUST NOT be accepted on these key-management routes.

#### Scenario: Create returns plaintext once
- **WHEN** `ADMIN` POSTs `{ "name": "crm-prod" }` with fewer than three active keys
- **THEN** the response is HTTP 201 including the raw key once, plus `id`, `name`, `prefix`, `createdAt`, and MUST NOT persist the raw key

#### Scenario: List never leaks secrets
- **WHEN** `ADMIN` GETs API keys
- **THEN** each item includes `id`, `name`, `prefix`, `createdAt`, `lastUsedAt`, `revokedAt` and MUST NOT include raw key or `keyHash`

#### Scenario: Fourth active key rejected
- **WHEN** tenant 4 has three unrevoked keys and `ADMIN` POSTs another
- **THEN** the API responds with HTTP 409 and MUST NOT create a fourth active key

#### Scenario: Revoked slot can be reused
- **WHEN** tenant 4 has three keys, one is revoked, and `ADMIN` POSTs a new key
- **THEN** the create succeeds (still at most three unrevoked)

#### Scenario: Super Admin cannot create keys
- **WHEN** `SUPER_ADMIN` POSTs an API key for tenant 4
- **THEN** the API responds with HTTP 403

### Requirement: API keys are stored hashed and authenticate as tenant Admin
The system SHALL store only a SHA-256 hex digest of the full raw key (`keyHash`, unique) plus a non-secret `prefix` for display. Authentication via header `X-API-KEY` MUST look up by digest of the presented value. A matching unrevoked key on an `apiAccessEnabled` tenant MUST populate the request principal as role `ADMIN` for that `tenantId` with `authKind=api_key` and MUST update `lastUsedAt`. Invalid, revoked, or unknown keys MUST return HTTP 401.

#### Scenario: Valid key authenticates as Admin
- **WHEN** a client sends a valid unrevoked `X-API-KEY` for tenant 4 to an allowlisted route
- **THEN** the request is authorized as `ADMIN` of tenant 4 without a human `userId`

#### Scenario: Revoked key rejected
- **WHEN** the presented key has `revokedAt` set
- **THEN** the API responds with HTTP 401

#### Scenario: Hash is not reversible from list
- **WHEN** an operator lists keys after creation
- **THEN** the stored `keyHash` MUST equal SHA-256 of the raw key shown at creation and MUST NOT appear in the list response
