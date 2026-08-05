## ADDED Requirements

### Requirement: Welcome resolves tenant by UUID from database
The system SHALL resolve `/sites/welcome/:uuid` by looking up `Tenant.uuid` in the database and MUST NOT rely on an in-memory hardcoded UUID-to-phone map for productive tenants.

#### Scenario: Known tenant UUID with phone
- **WHEN** a client requests welcome with a UUID that matches a tenant that has a phone
- **THEN** the system MUST redirect to a WhatsApp `wa.me` URL using that tenant's phone digits

#### Scenario: Unknown UUID
- **WHEN** a client requests welcome with a UUID that does not match any tenant
- **THEN** the system MUST serve the static fallback welcome page

#### Scenario: Known UUID without phone
- **WHEN** a client requests welcome with a UUID that matches a tenant without phone
- **THEN** the system MUST serve the static fallback welcome page

### Requirement: Template placeholder sanitization
The system SHALL strip known template placeholder noise (such as a leading `{{1}}`) from the UUID path parameter before database lookup, preserving current Meta template deep-link behavior.

#### Scenario: UUID wrapped with placeholder
- **WHEN** the path parameter contains `{{1}}` immediately before the UUID
- **THEN** the system MUST look up the tenant using the sanitized UUID
