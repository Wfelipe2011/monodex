## ADDED Requirements

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
