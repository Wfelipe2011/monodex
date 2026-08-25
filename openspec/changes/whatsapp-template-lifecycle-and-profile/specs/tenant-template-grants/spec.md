## MODIFIED Requirements

### Requirement: Admin lists only granted templates
The system SHALL allow tenant `ADMIN` to `GET /tenant/:tenantId/whatsapp-templates` returning only granted catalog rows including at least `id`, `name`, `language`, `status`, `slots`, `category`, `parameterFormat`, and raw Meta `components` (for client-side preview with placeholder substitution). That GET MUST NOT run a Meta sync. The system SHALL also allow `GET /tenant/:tenantId/whatsapp-templates/:templateId` for a single granted template with the same fields; ungranted or unknown ids MUST yield HTTP 404 without revealing whether the catalog id exists outside the grant set (treat as not found).

#### Scenario: List is grant-filtered
- **WHEN** the platform catalog has templates 10 and 11 and tenant 4 is granted only 10
- **THEN** `ADMIN` GET of tenant templates MUST include 10 and MUST NOT include 11

#### Scenario: List includes components for preview
- **WHEN** tenant 4 is granted template 10 whose BODY text contains `{{1}}`
- **THEN** the list item for 10 MUST include `components` with that BODY `text` and MUST include `slots` for the placeholders

#### Scenario: Get granted template by id
- **WHEN** tenant 4 is granted template 10 and `ADMIN` GETs `/tenant/4/whatsapp-templates/10`
- **THEN** the response MUST include preview fields including `components` and `slots`

#### Scenario: Get ungranted template is not found
- **WHEN** tenant 4 is not granted template 11 and `ADMIN` GETs `/tenant/4/whatsapp-templates/11`
- **THEN** the API MUST respond HTTP 404

#### Scenario: Super admin still lists full catalog
- **WHEN** `SUPER_ADMIN` GETs `/platform/whatsapp-templates`
- **THEN** the response includes the full catalog for the platform WABA, not filtered by grants

### Requirement: Granted template list is available via API key
The system SHALL allow `GET /tenant/:tenantId/whatsapp-templates` (and get-by-id when used) with a valid API key for that tenant, returning the same grant-filtered catalog rows and preview fields as tenant `ADMIN` JWT (including `components` and `slots`) and MUST NOT run a Meta sync.

#### Scenario: API key list is grant-filtered
- **WHEN** tenant 4 is granted only template 10 and a valid API key GETs tenant templates
- **THEN** the response MUST include 10 with `components` and MUST NOT include ungranted catalog templates
