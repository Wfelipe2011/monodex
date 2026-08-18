# tenant-scrape-requests Specification

## Purpose

Tenant Admin requests city/category scrape pairs that share a unique `ScrapeTarget`, constrained by city send policy, without re-enabling a Super-Admin-disabled target.

## Requirements

### Requirement: Admin requests scrape targets without duplicating pairs
The system SHALL allow an active tenant `ADMIN` to request a scrape target by city name (creating `City` if needed), optional state, and category. The system MUST upsert `ScrapeTarget` on `(cityId, category)` so Super Admin and other tenants share the same target row. The system MUST persist a per-tenant link so the Admin's list contains only targets they requested.

#### Scenario: New pair is created enabled
- **WHEN** no `ScrapeTarget` exists for Taubaté / Construtoras and `ADMIN` of an unrestricted tenant posts that pair
- **THEN** a `ScrapeTarget` is stored with `enabled=true`, a tenant link exists, and captura MUST include that pair while it remains enabled

#### Scenario: Existing pair is shared
- **WHEN** Super Admin or another tenant already has Taubaté / Construtoras and `ADMIN` posts the same pair
- **THEN** the system MUST NOT create a second `ScrapeTarget` and MUST create or keep the requesting tenant's link to the existing row

#### Scenario: Admin list is own links only
- **WHEN** tenant 4 linked target 1 and tenant 5 linked target 2
- **THEN** `ADMIN` of tenant 4 listing scrape requests MUST see target 1 and MUST NOT see target 2 unless also linked

### Requirement: Scrape requests respect city send policy
The system SHALL reject a tenant scrape request with HTTP 400 when the resolved `cityId` is outside `allowedCityIds` (if that array is non-empty) or is inside `deniedCityIds` (if that array is non-empty).

#### Scenario: Allowlist blocks other city
- **WHEN** tenant 4 allowedCityIds is `[1]` and Admin requests a city whose id is 2
- **THEN** the API responds with HTTP 400 and MUST NOT create a link

#### Scenario: Unrestricted tenant may create a new city
- **WHEN** tenant 4 has empty allow and deny arrays and Admin posts a city name that did not exist
- **THEN** a `City` MUST be created if needed and the request MAY succeed

### Requirement: Re-request does not re-enable a disabled shared target
When the Admin requests a pair whose `ScrapeTarget` already exists, the system MUST NOT set `enabled=true` as a side effect of the link. Super Admin `PATCH enabled=false` on the platform scrape target MUST cause captura to skip that pair for every tenant.

#### Scenario: Disabled target stays disabled after share
- **WHEN** target id 7 is `enabled=false` and tenant 4 requests the same city-category
- **THEN** a link for tenant 4 exists and `ScrapeTarget.enabled` remains false

#### Scenario: Super admin disable stops captura globally
- **WHEN** `SUPER_ADMIN` patches `{ enabled: false }` on `/platform/scrape-targets/:id`
- **THEN** subsequent captura crons MUST skip that pair even if tenants still have links
