## ADDED Requirements

### Requirement: Outreach categories must belong to tenant eligible scrape catalog
The system SHALL expose the set of acceptable outreach category strings for a tenant derived from enabled `ScrapeTarget` rows whose `cityId` is allowed by that tenant's `TenantSendPolicy` (respecting allow and deny lists). The set MUST include categories from targets linked to the tenant and categories from other enabled targets in allowed cities (global pool). Tenant-scoped outreach config writes (`tenant/:tenantId/outreach-config` PUT/PATCH) MUST reject any category not in that set with HTTP 400. Platform super-admin outreach writes on `/platform/tenants/:tenantId/outreach-config` MAY set any category that exists on at least one enabled `ScrapeTarget` globally without city filter.

#### Scenario: Eligible list includes shared city targets
- **WHEN** tenant is allowed city id 3 only, target enabled exists for city 3 category `Construtoras` linked to another tenant, and tenant 4 has no link to that target
- **THEN** eligible categories for tenant 4 MUST still include `Construtoras`

#### Scenario: Tenant write rejects unknown category
- **WHEN** tenant ADMIN PATCH sets `categories` to `["Fantasma"]` and no enabled target uses that string in an allowed city
- **THEN** the write MUST be rejected with HTTP 400

#### Scenario: Tenant write accepts catalog category
- **WHEN** eligible categories include `Clínicas médicas` and tenant PATCH sets `categories` to that value
- **THEN** the write MUST succeed

### Requirement: Eligible categories are readable via API
The system SHALL provide a read endpoint for tenant ADMIN returning the distinct sorted list of eligible category strings and optional metadata (city id/name per category) sufficient for frontends to populate outreach configuration.

#### Scenario: GET eligible categories
- **WHEN** tenant ADMIN calls the eligible categories endpoint
- **THEN** the response MUST list only categories derived from enabled scrape targets in allowed cities
