## MODIFIED Requirements

### Requirement: Outreach configuration exists per tenant
The system SHALL persist outreach settings per tenant, including at least: enabled flag, cost per lead, cashback on reply, outreach template name, notify-tenant template name, schedule, eligible categories, leads per run, header image URL, send interval seconds, and outreach contact text used as the outreach template body variable.

#### Scenario: Config created for tenant
- **WHEN** an outreach config is stored for a tenant
- **THEN** the system MUST associate exactly one config record with that tenant

#### Scenario: Disabled by default for new configs
- **WHEN** a new outreach config is created without an explicit enabled value
- **THEN** outreach MUST be treated as disabled until enabled is set true

## ADDED Requirements

### Requirement: Outreach contact text is a single validated string
The system SHALL persist exactly one `outreachContactText` per tenant outreach config. The value MUST be trimmed, MUST have length between 1 and 80 inclusive when written, and MUST NOT contain newline or tab characters. The system MUST NOT rotate or sample among multiple contact texts.

#### Scenario: Valid contact text stored
- **WHEN** a config is written with `outreachContactText` `Gladson Teixeira (contador em Pindamonhagaba)`
- **THEN** the stored value MUST equal that string (trimmed) and subsequent reads MUST return it

#### Scenario: Too long rejected
- **WHEN** a client writes `outreachContactText` longer than 80 characters
- **THEN** the write MUST be rejected

#### Scenario: Newline rejected
- **WHEN** a client writes `outreachContactText` containing a newline
- **THEN** the write MUST be rejected
