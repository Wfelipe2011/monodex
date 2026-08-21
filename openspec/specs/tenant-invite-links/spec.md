# tenant-invite-links Specification

## Purpose
TBD - created by archiving change tenant-invite-and-self-password. Update Purpose after archive.
## Requirements
### Requirement: Super Admin issues a first-admin claim invite without invitee identity
The system SHALL allow a `SUPER_ADMIN` to create a `FIRST_ADMIN` invite for a tenant that has zero users via `POST /platform/tenants/:tenantId/invites` with an empty identity body. The response MUST include the raw token **once**, a front URL containing that token, `expiresAt`, and `purpose` `FIRST_ADMIN`. The persisted row MUST store only a hash of the token, never the plaintext. TTL MUST be on the order of hours (default 8). Creating a new `FIRST_ADMIN` invite MUST revoke any previous pending `FIRST_ADMIN` invite for that tenant.

#### Scenario: Issue first-admin invite
- **WHEN** tenant 4 has no users and `SUPER_ADMIN` posts to `POST /platform/tenants/4/invites`
- **THEN** the API returns HTTP 201 with `purpose` `FIRST_ADMIN`, a short token, `url`, and `expiresAt` within hours, and the database row has `tokenHash` not equal to the raw token

#### Scenario: Invite when tenant already has a user
- **WHEN** tenant 4 already has a user and `SUPER_ADMIN` posts to `POST /platform/tenants/4/invites`
- **THEN** the API responds with HTTP 409 and does not create an invite

#### Scenario: Reissue revokes previous pending
- **WHEN** tenant 4 has a pending `FIRST_ADMIN` invite and `SUPER_ADMIN` posts another
- **THEN** the previous invite is revoked and the response contains a new raw token

### Requirement: Tenant Admin issues a user claim invite without invitee identity
The system SHALL allow an active tenant `ADMIN` to create a `TENANT_USER` invite via `POST /tenant/:tenantId/invites` with an empty identity body. The consumed user MUST receive `roles` including `USER` and MUST NOT receive `ADMIN` or `SUPER_ADMIN`. Multiple pending `TENANT_USER` invites per tenant MUST be allowed. `SUPER_ADMIN` MUST receive HTTP 403 on this POST.

#### Scenario: Admin issues user invite
- **WHEN** an `ADMIN` of tenant 4 posts to `POST /tenant/4/invites`
- **THEN** the API returns HTTP 201 with `purpose` `TENANT_USER`, a short token, `url`, and `expiresAt` within hours

#### Scenario: Super Admin cannot issue tenant-user invite
- **WHEN** `SUPER_ADMIN` posts to `POST /tenant/4/invites`
- **THEN** the API responds with HTTP 403

#### Scenario: Inactive tenant cannot issue
- **WHEN** tenant 4 has `active=false` and its `ADMIN` posts to `POST /tenant/4/invites`
- **THEN** the API responds with HTTP 403

### Requirement: Operators can list and revoke invites without seeing the raw token
The system SHALL allow `SUPER_ADMIN` to list and revoke `FIRST_ADMIN` invites under `/platform/tenants/:tenantId/invites`. The system SHALL allow tenant `ADMIN` to list and revoke `TENANT_USER` invites under `/tenant/:tenantId/invites`. List responses MUST include derived status (`PENDING`, `CONSUMED`, `REVOKED`, `EXPIRED`) and MUST NOT include the raw token or `tokenHash`.

#### Scenario: List omits secrets
- **WHEN** `SUPER_ADMIN` lists invites for tenant 4
- **THEN** each item has `id`, `purpose`, `status`, `expiresAt` and does not include `token` or `tokenHash`

#### Scenario: Revoke pending invite
- **WHEN** an authorized operator revokes a pending invite
- **THEN** subsequent public preview of that token returns HTTP 404

### Requirement: Public preview and accept consume a valid invite
The system SHALL expose unauthenticated `GET /public/invites/:token` and `POST /public/invites/:token/accept`. Preview MUST return `purpose`, `tenantName`, and `expiresAt` for a pending non-expired invite. Invalid, expired, revoked, or consumed tokens MUST return HTTP 404 with a generic error. Accept MUST require `{ name, username, email, password }`, create the user in the invite's tenant with hashed password, mark the invite consumed in the same transaction, and return `{ token }` as a JWT equivalent to `POST /auth/login`. Unique conflicts on email/username MUST return HTTP 409 and MUST NOT consume the invite. `FIRST_ADMIN` accept MUST create `roles` including `ADMIN` and MUST fail with HTTP 409 if the tenant already has users. `TENANT_USER` accept MUST create `roles` including `USER`. Accept MUST fail when the tenant is inactive.

#### Scenario: Preview pending invite
- **WHEN** a client GETs `/public/invites/:token` with a pending unexpired token
- **THEN** the response includes `purpose` and the tenant name and does not require a Bearer token

#### Scenario: Unknown token
- **WHEN** a client GETs or POSTs a token that is unknown, expired, revoked, or consumed
- **THEN** the API responds with HTTP 404

#### Scenario: Accept first admin
- **WHEN** tenant 4 has no users and a client posts valid name, username, email, and password to accept a `FIRST_ADMIN` token
- **THEN** a user with roles including `ADMIN` is created for tenant 4, the invite is consumed, and the response includes a JWT that authenticates as that user

#### Scenario: Accept tenant user
- **WHEN** a client accepts a pending `TENANT_USER` token with valid identity and password
- **THEN** a user with roles including `USER` (and not `ADMIN` or `SUPER_ADMIN`) is created in that tenant and the response includes a JWT

#### Scenario: Accept after password-create of first user
- **WHEN** tenant 4 already has a user and a client accepts a previously issued `FIRST_ADMIN` token
- **THEN** the API responds with HTTP 409 and does not create another user

#### Scenario: Duplicate email does not consume
- **WHEN** accept uses an email that already exists
- **THEN** the API responds with HTTP 409 and the invite remains pending

