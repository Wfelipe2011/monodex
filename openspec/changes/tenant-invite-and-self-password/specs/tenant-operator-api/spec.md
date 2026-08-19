## ADDED Requirements

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
