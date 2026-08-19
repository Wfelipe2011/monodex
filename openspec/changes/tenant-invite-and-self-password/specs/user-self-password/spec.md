## ADDED Requirements

### Requirement: Authenticated user changes their own password
The system SHALL allow any authenticated user (`SUPER_ADMIN`, `ADMIN`, or `USER`) to change their own password via `POST /auth/change-password` with `{ currentPassword, newPassword }`. The current password MUST match the stored hash. The new password MUST be persisted hashed (same bcrypt rounds as user create). The response MUST NOT include the password hash. No other user, including a Super Admin for a tenant Admin, MUST be required to approve or observe the new password. Failed current-password checks MUST NOT change the stored hash.

#### Scenario: Admin changes own password
- **WHEN** a tenant `ADMIN` posts a valid `currentPassword` and a `newPassword` of at least 6 characters to `POST /auth/change-password`
- **THEN** subsequent `POST /auth/login` with the new password succeeds and login with the old password fails

#### Scenario: Super Admin is not involved
- **WHEN** a tenant `ADMIN` changes their own password
- **THEN** the request succeeds without a Super Admin token and without any Super Admin API call

#### Scenario: Wrong current password
- **WHEN** the `currentPassword` does not match
- **THEN** the API responds with HTTP 401 or 400 and the stored password hash is unchanged

#### Scenario: Unauthenticated rejected
- **WHEN** a client posts to `POST /auth/change-password` without a valid Bearer token
- **THEN** the API responds with HTTP 401
