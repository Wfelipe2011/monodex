## ADDED Requirements

### Requirement: Shared scrape targets stay unique per city and category
The system SHALL keep `ScrapeTarget` uniqueness on `(cityId, category)` when tenants request the same pair. Captura MUST continue to scrape only rows with `enabled=true` and MUST NOT require a tenant link to scrape a pair (platform-created enabled targets remain eligible). Tenant visibility of requests is specified by `tenant-scrape-requests`.

#### Scenario: Platform-only enabled target still scrapes
- **WHEN** Super Admin created an enabled target with no tenant links
- **THEN** captura MUST still scrape that pair
