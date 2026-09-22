## ADDED Requirements

### Requirement: Tenant scrape API exposes on-demand controls for linked targets
The system SHALL extend tenant scrape target routes so an ADMIN with a link to a target can trigger on-demand scrape, read quota and cursor state, and disable on-demand for that link. These operations MUST delegate to the same rules as `scrape-on-demand` (quota, policy, locks, short run).

#### Scenario: On-demand route on tenant scrape target
- **WHEN** tenant ADMIN POSTs on-demand on `tenant/:tenantId/scrape-targets/:targetId/on-demand`
- **THEN** the system MUST validate the tenant link and apply on-demand rules

#### Scenario: Status includes quota
- **WHEN** tenant ADMIN GETs on-demand status for a linked target
- **THEN** the response MUST include runs used today, daily limit, cursor index, and on-demand enabled flag
