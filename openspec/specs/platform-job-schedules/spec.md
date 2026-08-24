# platform-job-schedules Specification

## Purpose

Persist configurable cron schedules for platform jobs (WhatsApp template sync and captura scrape) instead of hardcoded hours in application source.

## Requirements

### Requirement: Platform job schedules are persisted
The system SHALL persist a schedule row per `PlatformJobKey` of `WHATSAPP_TEMPLATE_SYNC` and `SCRAPE`, including cron expression (five fields), IANA timezone, and enabled flag. Defaults MUST be sync `0 5 * * *` and scrape `0 6 * * *`, timezone `America/Sao_Paulo`, enabled true.

#### Scenario: Default scrape hour
- **WHEN** no operator has changed the scrape schedule after seed
- **THEN** captura MUST still run the scrape job at 06:00 in `America/Sao_Paulo`

#### Scenario: Super admin changes sync cron
- **WHEN** `SUPER_ADMIN` PUTs cron `0 4 * * *` for `WHATSAPP_TEMPLATE_SYNC` with timezone `America/Sao_Paulo` and enabled true
- **THEN** subsequent template sync ticks MUST follow 04:00 in that timezone without a code change to cron literals

### Requirement: Disabled schedule does not fire cron
When a job schedule `enabled` is false, the system MUST NOT run that job on a timer. Manual `POST /admin/whatsapp-templates/sync` MUST still run when invoked.

#### Scenario: Sync cron disabled
- **WHEN** `WHATSAPP_TEMPLATE_SYNC` is stored with `enabled` false
- **THEN** the notifly process MUST NOT invoke catalog sync on a schedule

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
