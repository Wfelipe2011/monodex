## MODIFIED Requirements

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
