## ADDED Requirements

### Requirement: Tenant may trigger a short on-demand scrape for a linked target
The system SHALL allow an active tenant `ADMIN` to trigger an on-demand scrape for a `ScrapeTarget` linked via `TenantScrapeTarget`. The on-demand run MUST scrape only that target's category and city, MUST process a bounded number of neighborhoods per run (platform default 3) starting from a persisted cursor, and MUST use shorter Maps interaction limits than a full planned scrape. The on-demand run MUST NOT change scheduled lifecycle fields on `ScrapeCoverage`.

#### Scenario: Successful on-demand for linked target
- **WHEN** tenant ADMIN posts on-demand for a linked enabled target
- **THEN** captura MUST execute a short scrape for that city-category, persist leads with the existing upsert rules, and return run status including leads touched

#### Scenario: Unlinked target rejected
- **WHEN** tenant ADMIN posts on-demand for a target id without `TenantScrapeTarget` for that tenant
- **THEN** the API MUST respond with HTTP 404 or 403 and MUST NOT enqueue a scrape

#### Scenario: City policy blocks on-demand
- **WHEN** the target's `cityId` is outside the tenant send policy
- **THEN** the API MUST respond with HTTP 400 and MUST NOT enqueue a scrape

### Requirement: On-demand progress cursor avoids repeating the same neighborhood slice
The system SHALL persist per `(tenantId, scrapeTargetId)` an ordered neighborhood list snapshot (or stable order derived at first run) and `nextBairroIndex`. Each on-demand run MUST scrape neighborhoods starting at `nextBairroIndex` for up to the configured maximum count, then MUST advance the index. When the index reaches the end of the list, the next run MUST wrap to index zero.

#### Scenario: Second run continues after first
- **WHEN** the first on-demand run processed neighborhoods at indices 0 and 1 and `nextBairroIndex` is 2
- **THEN** the second on-demand run MUST start at neighborhood index 2 rather than index 0

#### Scenario: Wrap after last bairro
- **WHEN** `nextBairroIndex` equals the neighborhood count
- **THEN** the next on-demand run MUST reset processing to index 0

### Requirement: On-demand daily quota is two runs per tenant per target
The system SHALL reject on-demand requests when the tenant already has two or more on-demand runs for the same `scrapeTargetId` on the current local calendar day in `America/Sao_Paulo`. The limit MUST be enforced at request time.

#### Scenario: Third request same day rejected
- **WHEN** tenant already has two on-demand runs recorded today for target 7
- **THEN** a third POST MUST respond with HTTP 429

#### Scenario: Next day allowed
- **WHEN** the calendar day rolls over in America/Sao_Paulo
- **THEN** the tenant MAY trigger on-demand again for the same target subject to other rules

### Requirement: On-demand may be disabled per tenant target link
The system SHALL allow tenant ADMIN to disable further on-demand runs for a linked target without disabling the global `ScrapeTarget` or scheduled lifecycle. While disabled, POST on-demand MUST respond with HTTP 403 or 409.

#### Scenario: Tenant disables on-demand
- **WHEN** ADMIN patches on-demand settings to disabled for a linked target
- **THEN** subsequent POST on-demand MUST be rejected until re-enabled

### Requirement: Planned and on-demand scrapes exclude concurrent runs for the same pair
The system MUST NOT run a planned scrape and an on-demand scrape for the same `(cityId, category)` at the same time. A conflicting request MUST fail with HTTP 409 or queue until the lock clears.

#### Scenario: On-demand during planned run
- **WHEN** a planned scrape is running for city A category C
- **THEN** on-demand for that pair MUST NOT start until the planned run finishes
