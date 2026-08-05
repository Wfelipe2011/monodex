## ADDED Requirements

### Requirement: Cron selects eligible tenants from database
The Cloud API outreach scheduler SHALL select tenants that have outreach enabled, a non-empty phone, positive sufficient coin balance relative to configured cost, and a matching schedule window. It MUST NOT hardcode a single tenant id as the sole eligible tenant.

#### Scenario: Previously hardcoded tenant still works via config
- **WHEN** the tenant that previously was hardcoded (id 8) has outreach config enabled with schedule matching now
- **THEN** that tenant MUST still be processed by the scheduler

#### Scenario: Second enabled tenant is also processed
- **WHEN** another tenant also has outreach enabled, phone, balance, and matching schedule
- **THEN** the scheduler MUST process that tenant without code changes to tenant ids

#### Scenario: Disabled tenant skipped
- **WHEN** a tenant has outreach config disabled
- **THEN** the scheduler MUST NOT contact leads for that tenant

### Requirement: Lead pool remains global with per-tenant usage
The system SHALL continue to treat `Lead` as a shared pool and MUST record per-tenant usage through `TenantLead` (and related coin transactions) when contacting leads.

#### Scenario: Contact creates tenant-scoped funnel row
- **WHEN** outreach successfully contacts a lead for tenant T
- **THEN** a `TenantLead` for tenant T MUST exist/be updated and coin debit for tenant T MUST be recorded

#### Scenario: Same lead may be used by another tenant if not already bound by product rules
- **WHEN** lead L exists globally and is not yet contacted for tenant U under the current selection rules
- **THEN** tenant U MAY receive lead L through outreach independently of other tenants' funnel rows

### Requirement: Meta message id correlation
The system SHALL store the Cloud API outbound message id on `TenantLead.messageId` and SHALL use webhook `context.id` to correlate affirmative replies. `messageId` is a Meta correlation identifier and MUST NOT be modeled as a foreign key to the local `Message` table in this change.

#### Scenario: Store wamid after send
- **WHEN** Cloud API accepts an outbound outreach message
- **THEN** the corresponding `TenantLead.messageId` MUST be set to the returned message id

#### Scenario: Correlate reply
- **WHEN** a webhook message includes `context.id` matching a `TenantLead.messageId`
- **THEN** the system MUST update that tenant lead's reply funnel fields accordingly

### Requirement: Categories and schedule driven by config
Lead selection categories and send-time windows for a tenant SHALL be read from that tenant's outreach configuration rather than exclusively from hardcoded literals in application source.

#### Scenario: Category filter from config
- **WHEN** outreach selects candidate leads for a tenant
- **THEN** only leads whose category is included in that tenant's configured categories MUST be selected (subject to other existing filters retained intentionally)
