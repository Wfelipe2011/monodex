## ADDED Requirements

### Requirement: First tenant admin may be created without Super Admin choosing a password
The system SHALL allow the first tenant user to originate from a consumed `FIRST_ADMIN` invite as specified by `tenant-invite-links`, as an alternative to `POST /platform/tenants/:tenantId/users` with a password. Super Admin MUST still be allowed to create that first user with a password when the tenant has zero users. Creating the first user with a password MUST prevent subsequent successful accept of a `FIRST_ADMIN` invite for that tenant.

#### Scenario: Password create still works
- **WHEN** tenant 4 has no users and `SUPER_ADMIN` posts name, username, email, and password to `POST /platform/tenants/:tenantId/users`
- **THEN** a user is created with hashed password and roles including `ADMIN`

#### Scenario: Invite and password create cannot both become first user
- **WHEN** a first user is created with a password while a `FIRST_ADMIN` invite is still pending
- **THEN** accepting that invite MUST fail and MUST NOT create a second user

### Requirement: Tenant admin may add a USER without choosing their password
The system SHALL allow an active tenant `ADMIN` to add a `USER` via a `TENANT_USER` invite as specified by `tenant-invite-links`, as an alternative to posting a teammate with a password. Direct `POST /tenant/:tenantId/users` with password MUST remain allowed for `[ADMIN]` or `[USER]` roles.

#### Scenario: Admin still creates teammate with password
- **WHEN** `ADMIN` of tenant 4 posts a new user with roles `[ADMIN]` or `[USER]` and a password
- **THEN** the user is created for tenant 4
