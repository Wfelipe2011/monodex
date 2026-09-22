## MODIFIED Requirements

### Requirement: Scrape coverage is recorded per city-category
The system SHALL persist coverage for each `(cityId, category)` that a scrape attempts, including first run time, last run time, last status, and last lead count. Coverage MUST be written even when the pair was already scraped before. The system SHALL persist scheduled lifecycle fields on coverage: `schedulePhase` (`BOOTSTRAP`, `COOLDOWN_90D`, `RECURRING_180D`), `nextScheduledRunAt`, and `scheduledRunCount`. On-demand scrape runs MUST NOT advance `schedulePhase` or change `nextScheduledRunAt`.

#### Scenario: First successful scrape writes coverage
- **WHEN** a scrape of city A category C completes successfully
- **THEN** a coverage row for `(A, C)` MUST exist with `lastStatus` success, `lastRunAt` set, and `lastLeadCount` reflecting upserts attempted for that pair

#### Scenario: Repeat scrape updates coverage
- **WHEN** city A category C is scraped again after a previous coverage row exists
- **THEN** the system MUST update `lastRunAt`, `lastStatus`, and `lastLeadCount` and MUST keep the original `firstRunAt`

#### Scenario: Failed pair is still recorded
- **WHEN** a scrape of city A category C fails
- **THEN** coverage for `(A, C)` MUST still be upserted with a non-success `lastStatus`

#### Scenario: On-demand does not move scheduled cooldown
- **WHEN** an on-demand scrape completes for city A category C
- **THEN** `schedulePhase` and `nextScheduledRunAt` MUST remain unchanged from before that run

### Requirement: Scheduled scrape uses targets grouped by city
The captura scrape schedule SHALL be the persisted `PlatformJobSchedule` row with key `SCRAPE` (cron expression + timezone + enabled). The job SHALL load **scheduled-eligible** enabled targets (see lifecycle requirement), group them by city, ensure neighborhoods exist for that city (existing neighborhood scraper when the city has none), and scrape those categories for that city. Hardcoded scrape city and category constants MUST remain absent. The captura source MUST NOT use a sole hardcoded `@Cron('0 6 * * *')` as the only way to choose the hour.

#### Scenario: Two categories same city share one city run
- **WHEN** scheduled-eligible targets exist for city A with categories C1 and C2
- **THEN** the job MUST scrape both categories for city A using that city's neighborhoods

#### Scenario: Hardcoded Pindamonhangaba list is gone
- **WHEN** the captura scraper service is loaded
- **THEN** it MUST NOT use in-source constants as the sole list of cities or categories to scrape

#### Scenario: Schedule comes from database
- **WHEN** `SCRAPE` is stored as `0 8 * * *` in `America/Sao_Paulo` and enabled
- **THEN** the captura process MUST run the scrape job at 08:00 in that timezone rather than 06:00

## ADDED Requirements

### Requirement: Scheduled scrape lifecycle uses lead threshold and 90d then 180d cadence
For **planned** (cron) scrapes only, the system SHALL advance lifecycle using `lastLeadCount` on the completed run. While `schedulePhase` is `BOOTSTRAP`, planned runs MUST remain eligible on every cron tick (subject to business-hours capacity). When a planned run completes with `lastLeadCount >= 1`, the system MUST set `schedulePhase` to `COOLDOWN_90D` and `nextScheduledRunAt` to approximately ninety days after that run. When `schedulePhase` is `COOLDOWN_90D` and `now >= nextScheduledRunAt`, the next planned run MUST execute once and then set `schedulePhase` to `RECURRING_180D` with `nextScheduledRunAt` approximately one hundred eighty days later. When `schedulePhase` is `RECURRING_180D` and `now >= nextScheduledRunAt`, the system MUST run once per cycle and set `nextScheduledRunAt` to approximately one hundred eighty days after each completed planned run.

#### Scenario: Bootstrap until first lead
- **WHEN** coverage is in `BOOTSTRAP` and a planned run completes with `lastLeadCount = 0`
- **THEN** `schedulePhase` MUST remain `BOOTSTRAP` and the pair MUST remain eligible on subsequent cron ticks

#### Scenario: First lead enters ninety day wait
- **WHEN** coverage is in `BOOTSTRAP` and a planned run completes with `lastLeadCount >= 1`
- **THEN** `schedulePhase` MUST become `COOLDOWN_90D` and `nextScheduledRunAt` MUST be set at least eighty-nine days in the future

#### Scenario: After ninety days one run then six month cycle
- **WHEN** `schedulePhase` is `COOLDOWN_90D`, `nextScheduledRunAt` is in the past, and a planned run completes
- **THEN** `schedulePhase` MUST become `RECURRING_180D` and `nextScheduledRunAt` MUST be set at least one hundred seventy-nine days in the future

#### Scenario: Recurring six month run
- **WHEN** `schedulePhase` is `RECURRING_180D` and `nextScheduledRunAt` is in the past
- **THEN** the pair MUST be included in the planned scrape once and `nextScheduledRunAt` MUST advance by approximately one hundred eighty days after completion

### Requirement: Planned scrape respects business hours capacity
Between 08:00 and 18:00 inclusive in `America/Sao_Paulo`, each planned cron tick MUST process at most a configured maximum number of distinct `(cityId, category)` pairs (default 2). Outside that window, the planned job MUST NOT apply that pair limit. On-demand scrapes MUST NOT count toward that limit.

#### Scenario: Midday cap
- **WHEN** the planned cron fires at 10:00 America/Sao_Paulo and ten pairs are eligible
- **THEN** at most two pairs MUST start in that tick and remaining pairs MUST stay eligible for a later tick

#### Scenario: Night full throughput
- **WHEN** the planned cron fires at 22:00 America/Sao_Paulo and ten pairs are eligible
- **THEN** the job MAY process all eligible pairs subject to existing serial city execution and locks
