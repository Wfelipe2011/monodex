## MODIFIED Requirements

### Requirement: Lead pool remains global with per-tenant usage
The system SHALL continue to treat `Lead` as a shared pool and MUST record per-tenant usage through `TenantLead` when contacting leads. Coin debit for city outreach MUST follow `coin-debit-on-status` (not Graph acceptance alone). Selection MUST also apply `TenantSendPolicy` city filters and exclusivity phone exclusions. List campaign selection MUST NOT use those send policies. Phones whose only city sends for the tenant ended in `failed` MUST remain eligible for new city outreach for that tenant.

#### Scenario: Contact creates tenant-scoped funnel row
- **WHEN** outreach successfully contacts a lead for tenant T (Graph acceptance)
- **THEN** a `TenantLead` for tenant T MUST exist/be updated with the outbound `messageId`

#### Scenario: Coin debit deferred to status trigger
- **WHEN** outreach obtains Graph acceptance for tenant T and the billable status has not yet arrived
- **THEN** coin balance for tenant T MUST NOT yet decrease for that send

#### Scenario: Failed city phone may be contacted again
- **WHEN** lead L was contacted for tenant T and the outbound `wamid` later receives status `failed`
- **THEN** tenant T MAY receive lead L again through city outreach selection

#### Scenario: Same lead may be used by another tenant if not already bound by product rules
- **WHEN** lead L exists globally and is not yet contacted for tenant U under the current selection rules including send policies
- **THEN** tenant U MAY receive lead L through outreach independently of other tenants' funnel rows unless a send policy excludes that phone

### Requirement: Cron selects eligible tenants from database
The Cloud API outreach scheduler SHALL select tenants that have `Tenant.active` true, outreach enabled, a non-empty phone, positive sufficient **available** coin balance relative to configured cost (balance minus reserved pending uncharged city sends × `costPerLead`), and a matching schedule window. It MUST NOT hardcode a single tenant id as the sole eligible tenant. Tenants with `active=false` MUST be skipped even if outreach is enabled.

#### Scenario: Previously hardcoded tenant still works via config
- **WHEN** the tenant that previously was hardcoded (id 8) has outreach config enabled with schedule matching now and `active` true
- **THEN** that tenant MUST still be processed by the scheduler

#### Scenario: Second enabled tenant is also processed
- **WHEN** another tenant also has outreach enabled, phone, available balance, matching schedule, and `active` true
- **THEN** the scheduler MUST process that tenant without code changes to tenant ids

#### Scenario: Disabled tenant skipped
- **WHEN** a tenant has outreach config disabled
- **THEN** the scheduler MUST NOT contact leads for that tenant

#### Scenario: Inactive tenant skipped
- **WHEN** a tenant has `active=false` and outreach enabled with a matching schedule
- **THEN** the scheduler MUST NOT contact leads for that tenant

#### Scenario: Pending reservation blocks overspend
- **WHEN** raw balance covers one lead but one pending uncharged city send already exists
- **THEN** the scheduler MUST NOT contact an additional lead for that tenant
