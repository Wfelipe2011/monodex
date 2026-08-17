## MODIFIED Requirements

### Requirement: Platform Cloud API account is explicit
The system SHALL persist a platform-level WhatsApp Cloud API account reference that includes at least `phoneNumberId`, `wabaId`, and a pointer to the environment key used for the access token. The access token itself MUST NOT be stored in the database. `wabaId` MUST be used when listing message templates from Graph.

#### Scenario: Resolve send credentials
- **WHEN** the system sends a WhatsApp Cloud API message
- **THEN** it MUST use the enabled platform account's `phoneNumberId` and MUST read the token from the configured environment key

#### Scenario: Token not in database
- **WHEN** a platform WhatsApp account record is created or updated
- **THEN** the system MUST NOT persist the raw access token as a column value

#### Scenario: Resolve WABA for template list
- **WHEN** the system syncs message templates
- **THEN** it MUST call Graph using the enabled platform account's `wabaId`
