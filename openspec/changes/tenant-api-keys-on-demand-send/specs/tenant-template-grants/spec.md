## ADDED Requirements

### Requirement: Granted template list is available via API key
The system SHALL allow `GET /tenant/:tenantId/whatsapp-templates` with a valid API key for that tenant, returning the same grant-filtered catalog rows as tenant `ADMIN` JWT (at least id, name, language, status, slots) and MUST NOT run a Meta sync.

#### Scenario: API key list is grant-filtered
- **WHEN** tenant 4 is granted only template 10 and a valid API key GETs tenant templates
- **THEN** the response MUST include 10 and MUST NOT include ungranted catalog templates
