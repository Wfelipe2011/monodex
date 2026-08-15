## ADDED Requirements

### Requirement: Outreach template body uses configured contact text
When sending the tenant outreach Cloud API template, the system SHALL include a positional body text parameter whose value is that tenant's `outreachContactText`. The system MUST NOT use a platform-wide environment fallback for this parameter. If `outreachContactText` is missing or empty after trim, the system MUST NOT send the template for that lead.

#### Scenario: Body parameter filled from config
- **WHEN** a tenant has `outreachContactText` `Gladson Teixeira (contador em Pindamonhagaba)` and outreach sends a template
- **THEN** the Cloud API request MUST include a body component with a positional text parameter equal to that string

#### Scenario: Empty contact text skips send
- **WHEN** a tenant is otherwise eligible but `outreachContactText` is empty
- **THEN** the system MUST NOT POST an outreach template to Cloud API for that run's leads
