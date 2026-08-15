## MODIFIED Requirements

### Requirement: Outreach configuration exists per tenant
The system SHALL persist outreach settings per tenant, including at least: enabled flag, cost per lead, cashback on reply, outreach template name, notify-tenant template name, schedule, eligible categories, leads per run, header image URL, and send interval seconds.

#### Scenario: Config created for tenant
- **WHEN** an outreach config is stored for a tenant
- **THEN** the system MUST associate exactly one config record with that tenant

#### Scenario: Disabled by default for new configs
- **WHEN** a new outreach config is created without an explicit enabled value
- **THEN** outreach MUST be treated as disabled until enabled is set true

#### Scenario: Send knobs default when omitted
- **WHEN** a new outreach config is created without `leadsPerRun`, `sendIntervalSeconds`, or `headerImageUrl`
- **THEN** `leadsPerRun` MUST be 5, `sendIntervalSeconds` MUST be 5, and `headerImageUrl` MAY be null

## ADDED Requirements

### Requirement: Send knobs are validated
The system SHALL reject outreach config writes when `leadsPerRun` is less than 1 or `sendIntervalSeconds` is less than 0. When `headerImageUrl` is provided, it MUST be an https URL.

#### Scenario: Zero leads per run rejected
- **WHEN** a client sets `leadsPerRun` to 0
- **THEN** the write MUST be rejected

#### Scenario: Negative interval rejected
- **WHEN** a client sets `sendIntervalSeconds` to -1
- **THEN** the write MUST be rejected
