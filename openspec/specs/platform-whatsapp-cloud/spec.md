# platform-whatsapp-cloud Specification

## Purpose

Platform-level WhatsApp Cloud API account used for all official outbound outreach and tenant notifications; token remains in environment secrets.
## Requirements
### Requirement: Platform Cloud API account is explicit
The system SHALL persist one or more platform-level WhatsApp Cloud API account references that each include at least `phoneNumberId`, `wabaId`, and a pointer to the environment key used for the access token. All platform accounts in this capability MUST share one `wabaId`. Exactly one enabled platform account MUST be marked default. The access token itself MUST NOT be stored in the database. `wabaId` of the default account MUST be used when listing message templates from Graph.

#### Scenario: Resolve send credentials
- **WHEN** the system sends a WhatsApp Cloud API message for a tenant
- **THEN** it MUST use that tenant's resolved account `phoneNumberId` (dedicated assignment if set, otherwise the default account) and MUST read the token from the resolved account's environment key

#### Scenario: Token not in database
- **WHEN** a platform WhatsApp account record is created or updated
- **THEN** the system MUST NOT persist the raw access token as a column value

#### Scenario: Resolve WABA for template list
- **WHEN** the system syncs message templates
- **THEN** it MUST call Graph using the enabled default platform account's `wabaId`

### Requirement: Single platform sender for official outreach
The system SHALL send official outbound lead templates and tenant notifications via a platform Cloud API account on the shared WABA: the tenant's dedicated `phoneNumberId` when assigned, otherwise the default platform `phoneNumberId`. The notification MUST still be addressed TO the tenant's phone (`Tenant.phone`).

#### Scenario: Outbound lead template
- **WHEN** outreach contacts a lead for an eligible tenant with no dedicated assignment
- **THEN** the Graph API request MUST target the default platform account phone number id

#### Scenario: Outbound lead template on dedicated number
- **WHEN** outreach contacts a lead for a tenant assigned to platform account A
- **THEN** the Graph API request MUST target account A's phone number id

#### Scenario: Notify tenant on affirmative reply
- **WHEN** a lead replies affirmatively and the tenant is notified
- **THEN** the notification MUST be sent via the tenant's resolved platform Cloud API account TO the tenant's phone

### Requirement: Baileys out of scope for official sends
Official productive outreach in this capability SHALL use WhatsApp Cloud API only. Baileys-based sending is out of scope and MUST NOT be required for the outreach flow defined here.

#### Scenario: Outreach path independence from Baileys
- **WHEN** the Cloud API outreach flow runs
- **THEN** it MUST NOT depend on `baileys.wfelipe.com.br` authentication or send endpoints

