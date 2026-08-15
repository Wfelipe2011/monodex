## MODIFIED Requirements

### Requirement: Super admin manages tenant outreach config
The system SHALL allow a `SUPER_ADMIN` to get, put (upsert), and patch `TenantOutreachConfig` for a tenant, including `enabled`, `costPerLead`, `cashbackOnReply`, `outreachTemplateName`, `notifyTenantTemplateName`, `schedule`, `categories`, `leadsPerRun`, `headerImageUrl`, and `sendIntervalSeconds`.

#### Scenario: Upsert outreach config
- **WHEN** `SUPER_ADMIN` sends a full config body to `PUT /admin/tenants/:tenantId/outreach-config`
- **THEN** the config is created or replaced for that tenant and returned

#### Scenario: Toggle enabled
- **WHEN** `SUPER_ADMIN` patches `{ enabled: true }` on a tenant that has `phone` set and `active` true and remaining required fields already present
- **THEN** `outreachConfig.enabled` becomes true

#### Scenario: Patch send knobs
- **WHEN** `SUPER_ADMIN` patches `{ leadsPerRun: 10, sendIntervalSeconds: 5, headerImageUrl: "https://example.com/header.png" }`
- **THEN** those three fields MUST be persisted and returned on a subsequent GET

## ADDED Requirements

### Requirement: Super admin manages scrape targets
The system SHALL allow a `SUPER_ADMIN` to list, create, update, and disable/delete scrape targets. Creating a target MUST accept a city name (creating the `City` if needed) and a category string, and MUST upsert on `(cityId, category)`. The API MUST NOT launch Puppeteer as a synchronous side effect of the write.

#### Scenario: Create target for new city
- **WHEN** `SUPER_ADMIN` posts `{ cityName: "Taubaté", state: "SP", category: "Construtoras", enabled: true }` to `POST /admin/scrape-targets`
- **THEN** a `City` for Taubaté MUST exist if it did not, a `ScrapeTarget` for that city and category MUST be enabled, and the response MUST include the target id

#### Scenario: Duplicate target is upserted
- **WHEN** a target for the same city and category already exists and `SUPER_ADMIN` posts the same pair
- **THEN** the API MUST NOT create a second row and MUST return the existing target (updated `enabled` if sent)

#### Scenario: Disable target
- **WHEN** `SUPER_ADMIN` patches `{ enabled: false }` on `PATCH /admin/scrape-targets/:id`
- **THEN** subsequent captura crons MUST skip that pair

### Requirement: Super admin can read scrape coverage
The system SHALL allow a `SUPER_ADMIN` to list scrape coverage rows (city, category, first/last run, status, last lead count). The API MUST be read-only for coverage in this change.

#### Scenario: List coverage
- **WHEN** `SUPER_ADMIN` calls `GET /admin/scrape-coverages`
- **THEN** the response MUST include persisted coverage rows without requiring a code deploy
