## ADDED Requirements

### Requirement: Orphan media cleanup and on-demand schedule runner are persisted jobs
The system SHALL persist schedule rows for `PlatformJobKey` values `ORPHAN_MEDIA_CLEANUP` and `ON_DEMAND_SCHEDULE_RUN` in addition to `WHATSAPP_TEMPLATE_SYNC` and `SCRAPE`, each with five-field cron, IANA timezone, and enabled flag. Defaults MUST be cleanup `0 3 1,16 * *` on gym-ctrl and on-demand runner `0 * * * *` on notifly, timezone `America/Sao_Paulo`, enabled true. Super Admin MUST continue to GET/PUT these rows via existing `/platform/platform-job-schedules` APIs.

#### Scenario: Default cleanup cron
- **WHEN** no operator has changed `ORPHAN_MEDIA_CLEANUP` after seed
- **THEN** gym-ctrl MUST schedule orphan file cleanup at 03:00 on days 1 and 16 in `America/Sao_Paulo`

#### Scenario: Super Admin changes schedule runner
- **WHEN** `SUPER_ADMIN` PUTs cron `30 * * * *` for `ON_DEMAND_SCHEDULE_RUN` with timezone `America/Sao_Paulo` and enabled true
- **THEN** subsequent notifly ticks MUST follow that expression without a code change to cron literals

#### Scenario: Disabled on-demand runner does not fire
- **WHEN** `ON_DEMAND_SCHEDULE_RUN` is stored with `enabled` false
- **THEN** notifly MUST NOT send due schedules on a timer
