## ADDED Requirements

### Requirement: City policy is allowlist XOR denylist
The system SHALL persist per tenant a city send policy with `allowedCityIds` and `deniedCityIds` arrays of city ids. The system MUST reject a write when both arrays are non-empty. When both arrays are empty, city outreach MUST NOT filter by city. The policy MUST apply only to global `Lead` city outreach and to tenant scrape requests, not to list-campaign CSV sends.

#### Scenario: Allowlist only
- **WHEN** `SUPER_ADMIN` PUTs send policy `{ allowedCityIds: [1], deniedCityIds: [] }` for tenant 4
- **THEN** subsequent city outreach for tenant 4 MUST only select leads with `cityId=1`

#### Scenario: Denylist only
- **WHEN** `SUPER_ADMIN` PUTs `{ allowedCityIds: [], deniedCityIds: [2] }` for tenant 4
- **THEN** city outreach for tenant 4 MUST NOT select leads with `cityId=2` and MAY select other cities

#### Scenario: Both lists rejected
- **WHEN** `SUPER_ADMIN` PUTs non-empty `allowedCityIds` and non-empty `deniedCityIds`
- **THEN** the API responds with HTTP 400 and MUST NOT persist that combination

#### Scenario: Empty means unrestricted
- **WHEN** tenant 4 has both city arrays empty
- **THEN** city outreach MUST NOT exclude leads solely for `cityId`

#### Scenario: List campaign ignores city policy
- **WHEN** tenant 4 has `allowedCityIds: [1]` and a list campaign has eligible list leads
- **THEN** the list campaign cron MUST NOT skip those leads because of city policy

### Requirement: Pairwise respect excludes contacted phones
The system SHALL persist directed respect edges: tenant X respects tenant Y meaning X MUST NOT be selected a global `Lead` whose `phone` appears on any `TenantLead` of Y with `contacted=true`, regardless of `cityId`. Historical `contacted=true` rows MUST count (no start timestamp). List campaigns MUST NOT apply these edges.

#### Scenario: X respects Y skips Y contacted phone in another city
- **WHEN** Y has `TenantLead.contacted=true` for phone `P` in city A and X respects Y
- **THEN** city outreach for X MUST NOT select a lead with phone `P` in city B

#### Scenario: Retroactive history
- **WHEN** Y contacted phone `P` yesterday and today Super Admin adds edge X respects Y
- **THEN** the next city outreach run for X MUST exclude phone `P`

#### Scenario: Directed not symmetric
- **WHEN** X respects Y and Y does not respect X
- **THEN** Y MAY still be selected leads that X has `contacted=true`

### Requirement: respectAllTenants and exclusive flags
The system SHALL persist `respectAllTenants` and `exclusive` booleans on the tenant send policy. When X has `respectAllTenants=true`, city outreach for X MUST exclude phones with `contacted=true` on any other tenant. When Y has `exclusive=true`, city outreach for every other tenant MUST exclude phones Y has `contacted=true`. Flags MUST combine with pairwise edges by union of excluded phones.

#### Scenario: Respect all tenants
- **WHEN** tenant X has `respectAllTenants=true` and tenant Z contacted phone `P`
- **THEN** city outreach for X MUST NOT select phone `P`

#### Scenario: Exclusive tenant
- **WHEN** tenant Y has `exclusive=true` and contacted phone `P`, and tenant X has no pairwise edge
- **THEN** city outreach for X MUST NOT select phone `P`

#### Scenario: Exclusive does not block self
- **WHEN** tenant Y has `exclusive=true`
- **THEN** city outreach for Y MUST still consider phones only Y has contacted, subject to Y's own used-phone rules

### Requirement: Super admin owns send policy writes
The system SHALL allow only `SUPER_ADMIN` to PUT/PATCH send policy and respect edges under `/platform/tenants/:tenantId/send-policy`. Tenant `ADMIN` MUST be allowed to GET the policy for their tenant (read-only).

#### Scenario: Admin cannot write policy
- **WHEN** tenant `ADMIN` PUTs send policy
- **THEN** the API responds with HTTP 403

#### Scenario: Admin can read policy
- **WHEN** tenant `ADMIN` GETs send policy for their tenant
- **THEN** the response includes city arrays, flags, and respect tenant ids
