# scrape-catalog Specification

## Purpose

Persist scrape targets as city-category pairs, record coverage per pair, and drive the scheduled captura scrape from the database instead of hardcoded lists.

## Requirements

### Requirement: Scrape targets are persisted city-category pairs
The system SHALL persist scrape targets as enabled/disabled pairs of `cityId` and `category`. The pair `(cityId, category)` MUST be unique. The daily captura scrape MUST read enabled targets from the database and MUST NOT require application source changes to add a city or category.

#### Scenario: New city and category without deploy
- **WHEN** an enabled scrape target exists for city `Taubaté` and category `Clínicas médicas`
- **THEN** the scheduled scrape MUST include that pair in the next run without a code change to scrape constants

#### Scenario: Disabled target is skipped
- **WHEN** a scrape target exists with `enabled=false`
- **THEN** the scheduled scrape MUST NOT scrape that city-category pair

#### Scenario: No enabled targets
- **WHEN** the scheduled scrape runs and no scrape target is enabled
- **THEN** the job MUST no-op without launching a Maps scrape and MUST log that there is nothing to do

### Requirement: Scrape coverage is recorded per city-category
The system SHALL persist coverage for each `(cityId, category)` that a scrape attempts, including first run time, last run time, last status, and last lead count. Coverage MUST be written even when the pair was already scraped before. This change MUST NOT implement skip/rotation policy based on coverage age.

#### Scenario: First successful scrape writes coverage
- **WHEN** a scrape of city A category C completes successfully
- **THEN** a coverage row for `(A, C)` MUST exist with `lastStatus` success, `lastRunAt` set, and `lastLeadCount` reflecting upserts attempted for that pair

#### Scenario: Repeat scrape updates coverage
- **WHEN** city A category C is scraped again after a previous coverage row exists
- **THEN** the system MUST update `lastRunAt`, `lastStatus`, and `lastLeadCount` and MUST keep the original `firstRunAt`

#### Scenario: Failed pair is still recorded
- **WHEN** a scrape of city A category C fails
- **THEN** coverage for `(A, C)` MUST still be upserted with a non-success `lastStatus`

### Requirement: Scheduled scrape uses targets grouped by city
The captura scrape schedule SHALL be the persisted `PlatformJobSchedule` row with key `SCRAPE` (cron expression + timezone + enabled). The job SHALL load enabled targets, group them by city, ensure neighborhoods exist for that city (existing neighborhood scraper when the city has none), and scrape those categories for that city. Hardcoded scrape city and category constants MUST remain absent. The captura source MUST NOT use a sole hardcoded `@Cron('0 6 * * *')` as the only way to choose the hour.

#### Scenario: Two categories same city share one city run
- **WHEN** enabled targets exist for city A with categories C1 and C2
- **THEN** the job MUST scrape both categories for city A using that city's neighborhoods

#### Scenario: Hardcoded Pindamonhangaba list is gone
- **WHEN** the captura scraper service is loaded
- **THEN** it MUST NOT use in-source constants as the sole list of cities or categories to scrape

#### Scenario: Schedule comes from database
- **WHEN** `SCRAPE` is stored as `0 8 * * *` in `America/Sao_Paulo` and enabled
- **THEN** the captura process MUST run the scrape job at 08:00 in that timezone rather than 06:00

### Requirement: Shared scrape targets stay unique per city and category
The system SHALL keep `ScrapeTarget` uniqueness on `(cityId, category)` when tenants request the same pair. Captura MUST continue to scrape only rows with `enabled=true` and MUST NOT require a tenant link to scrape a pair (platform-created enabled targets remain eligible). Tenant visibility of requests is specified by `tenant-scrape-requests`.

#### Scenario: Platform-only enabled target still scrapes
- **WHEN** Super Admin created an enabled target with no tenant links
- **THEN** captura MUST still scrape that pair

