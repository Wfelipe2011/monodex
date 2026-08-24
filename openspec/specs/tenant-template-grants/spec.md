# tenant-template-grants Specification

## Purpose

Super Admin grants catalog WhatsApp templates to tenants; tenant Admin may only list and select granted template ids on outreach, notify, and list campaigns.

## Requirements

### Requirement: Super admin grants catalog templates to tenants
The system SHALL persist grants of `WhatsappMessageTemplate` ids to tenants. The same template id MAY be granted to more than one tenant. Grant writes MUST be `SUPER_ADMIN` only under `/platform/tenants/:tenantId/template-grants`.

#### Scenario: Grant one template to two tenants
- **WHEN** `SUPER_ADMIN` grants template 10 to tenant 4 and to tenant 5
- **THEN** both tenants include template 10 in their grant lists and only one catalog row exists

#### Scenario: Admin cannot grant
- **WHEN** tenant `ADMIN` POSTs a template grant
- **THEN** the API responds with HTTP 403

### Requirement: Tenant-owned template ids must be granted
When an `ADMIN` (or Super Admin within the bootstrap window) writes `outreachTemplateId`, `notifyTemplateId`, list campaign `templateId`, or campaign `notifyTemplateId`, the system MUST reject the write with HTTP 400 unless that template id is granted to the tenant.

#### Scenario: Ungranted outreach template rejected
- **WHEN** tenant 4 has no grant for template 10 and `ADMIN` patches `outreachTemplateId=10`
- **THEN** the API responds with HTTP 400 and MUST NOT persist that id

#### Scenario: Granted template accepted
- **WHEN** template 10 is granted to tenant 4 and `ADMIN` patches `outreachTemplateId=10` with other enable rules satisfied or not yet enabling
- **THEN** the id is persisted (enable rules still apply when `enabled=true`)

### Requirement: Admin lists only granted templates
The system SHALL allow tenant `ADMIN` to `GET /tenant/:tenantId/whatsapp-templates` returning only granted catalog rows (at least id, name, language, status, slots). That GET MUST NOT run a Meta sync.

#### Scenario: List is grant-filtered
- **WHEN** the platform catalog has templates 10 and 11 and tenant 4 is granted only 10
- **THEN** `ADMIN` GET of tenant templates MUST include 10 and MUST NOT include 11

#### Scenario: Super admin still lists full catalog
- **WHEN** `SUPER_ADMIN` GETs `/platform/whatsapp-templates`
- **THEN** the response includes the full catalog for the platform WABA, not filtered by grants

### Requirement: Granted template list is available via API key
The system SHALL allow `GET /tenant/:tenantId/whatsapp-templates` with a valid API key for that tenant, returning the same grant-filtered catalog rows as tenant `ADMIN` JWT (at least id, name, language, status, slots) and MUST NOT run a Meta sync.

#### Scenario: API key list is grant-filtered
- **WHEN** tenant 4 is granted only template 10 and a valid API key GETs tenant templates
- **THEN** the response MUST include 10 and MUST NOT include ungranted catalog templates
