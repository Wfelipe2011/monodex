## ADDED Requirements

### Requirement: Allowlisted tenant routes accept X-API-KEY or JWT
The system SHALL accept either `Authorization: Bearer` JWT or header `X-API-KEY` on the allowlisted `/tenant/:tenantId/*` routes defined by on-demand send, conversations, media (authenticated), schedules, and granted-template list. Presenting both credentials together MUST return HTTP 400. A valid API key on a non-allowlisted route, including all `/platform/*` routes and `/tenant/:tenantId/api-keys`, MUST return HTTP 401. `@Public()` routes MUST continue to work without either credential.

#### Scenario: API key on conversations list
- **WHEN** a valid API key for tenant 4 GETs `/tenant/4/conversations`
- **THEN** the API responds HTTP 200 with that tenant's threads

#### Scenario: API key on platform rejected
- **WHEN** a valid API key GETs `/platform/tenants`
- **THEN** the API responds with HTTP 401

#### Scenario: Both credentials rejected
- **WHEN** a request includes Bearer JWT and `X-API-KEY`
- **THEN** the API responds with HTTP 400

#### Scenario: Key on coins rejected
- **WHEN** a valid API key POSTs `/tenant/4/coins/debit` or equivalent coin write
- **THEN** the API responds with HTTP 401

### Requirement: API-key principal is scoped like tenant Admin
When authenticated via API key, `TenantScopeGuard` MUST treat `tenantId` from the key the same way as JWT `ADMIN` (own tenant only). Super Admin JWT behavior on `/tenant/*` (read any tenant, no pontapé writes on this channel) is unchanged.

#### Scenario: Key cannot access another tenant
- **WHEN** an API key issued for tenant 4 GETs `/tenant/9/conversations`
- **THEN** the API responds with HTTP 403
