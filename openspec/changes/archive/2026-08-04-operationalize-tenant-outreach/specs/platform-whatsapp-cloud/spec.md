## ADDED Requirements

### Requirement: Platform Cloud API account is explicit
The system SHALL persist a platform-level WhatsApp Cloud API account reference that includes at least `phoneNumberId` and a pointer to the environment key used for the access token. The access token itself MUST NOT be stored in the database.

#### Scenario: Resolve send credentials
- **WHEN** the system sends a WhatsApp Cloud API message
- **THEN** it MUST use the enabled platform account's `phoneNumberId` and MUST read the token from the configured environment key

#### Scenario: Token not in database
- **WHEN** a platform WhatsApp account record is created or updated
- **THEN** the system MUST NOT persist the raw access token as a column value

### Requirement: Single platform sender for official outreach
The system SHALL use the platform Cloud API account for official outbound lead templates and for notifying the tenant after an affirmative lead reply.

#### Scenario: Outbound lead template
- **WHEN** outreach contacts a lead for any eligible tenant
- **THEN** the Graph API request MUST target the platform account phone number id

#### Scenario: Notify tenant on affirmative reply
- **WHEN** a lead replies affirmatively and the tenant is notified
- **THEN** the notification MUST be sent via the platform Cloud API account TO the tenant's phone

### Requirement: Baileys out of scope for official sends
Official productive outreach in this capability SHALL use WhatsApp Cloud API only. Baileys-based sending is out of scope and MUST NOT be required for the outreach flow defined here.

#### Scenario: Outreach path independence from Baileys
- **WHEN** the Cloud API outreach flow runs
- **THEN** it MUST NOT depend on `baileys.wfelipe.com.br` authentication or send endpoints
