## MODIFIED Requirements

### Requirement: Cron selects eligible tenants from database
The Cloud API outreach scheduler SHALL select tenants that have `Tenant.active` true, outreach enabled, a non-empty phone, positive sufficient coin balance relative to configured cost, and a matching schedule window. It MUST NOT hardcode a single tenant id as the sole eligible tenant. Tenants with `active=false` MUST be skipped even if outreach is enabled.

#### Scenario: Previously hardcoded tenant still works via config
- **WHEN** the tenant that previously was hardcoded (id 8) has outreach config enabled with schedule matching now and `active` true
- **THEN** that tenant MUST still be processed by the scheduler

#### Scenario: Second enabled tenant is also processed
- **WHEN** another tenant also has outreach enabled, phone, balance, matching schedule, and `active` true
- **THEN** the scheduler MUST process that tenant without code changes to tenant ids

#### Scenario: Disabled tenant skipped
- **WHEN** a tenant has outreach config disabled
- **THEN** the scheduler MUST NOT contact leads for that tenant

#### Scenario: Inactive tenant skipped
- **WHEN** a tenant has `active=false` and outreach enabled with a matching schedule
- **THEN** the scheduler MUST NOT contact leads for that tenant

### Requirement: Lead pool remains global with per-tenant usage
The system SHALL continue to treat `Lead` as a shared pool and MUST record per-tenant usage through `TenantLead` (and related coin transactions) when contacting leads. Selection MUST also apply `TenantSendPolicy` city filters and exclusivity phone exclusions. List campaign selection MUST NOT use those send policies.

#### Scenario: Contact creates tenant-scoped funnel row
- **WHEN** outreach successfully contacts a lead for tenant T
- **THEN** a `TenantLead` for tenant T MUST exist/be updated and coin debit for tenant T MUST be recorded

#### Scenario: Same lead may be used by another tenant if not already bound by product rules
- **WHEN** lead L exists globally and is not yet contacted for tenant U under the current selection rules including send policies
- **THEN** tenant U MAY receive lead L through outreach independently of other tenants' funnel rows unless a send policy excludes that phone

## ADDED Requirements

### Requirement: City outreach applies send policy in contactLeads
When selecting global leads for a tenant, `contactLeads` MUST apply `TenantSendPolicy` city allow/deny and MUST exclude phones with `TenantLead.contacted=true` for respected tenants (pairwise, `respectAllTenants`, and other tenants with `exclusive=true`), across cities. Own-tenant used phones MUST remain excluded as today.

#### Scenario: Allowlist filters city
- **WHEN** tenant 4 allowedCityIds is `[1]` and unused matching-category leads exist in cities 1 and 2
- **THEN** the batch MUST NOT include city 2 leads

#### Scenario: Exclusive phone excluded
- **WHEN** tenant Y is `exclusive` and contacted phone `P` and tenant X has an unused lead with phone `P`
- **THEN** tenant X MUST NOT select that phone
