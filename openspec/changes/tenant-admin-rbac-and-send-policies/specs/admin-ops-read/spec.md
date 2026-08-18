## MODIFIED Requirements

### Requirement: Platform operations summary
The system SHALL provide a `SUPER_ADMIN`-only summary endpoint aggregating platform operational counts useful for onboarding verification at `GET /platform/ops/summary`.

#### Scenario: Summary returns key counters
- **WHEN** `SUPER_ADMIN` calls `GET /platform/ops/summary`
- **THEN** the response includes at least: total tenants, active tenants, tenants with outreach enabled, and total leads in the global pool (non-deleted)

### Requirement: Tenant lead funnel stats
The system SHALL allow a tenant `ADMIN` to retrieve `TenantLead` funnel counts for their tenant at `GET /tenant/:tenantId/leads/stats`. `SUPER_ADMIN` MUST be allowed to GET the same path for any tenant.

#### Scenario: Funnel stats by tenant
- **WHEN** `ADMIN` of tenant 4 calls `GET /tenant/4/leads/stats`
- **THEN** the response includes counts for contacted, replied, quoted, closed, and deleted (or equivalent boolean aggregations on `TenantLead`)

### Requirement: Global lead pool count
The system SHALL allow a `SUPER_ADMIN` to retrieve the count of leads in the global marketplace pool at `GET /platform/leads/count`.

#### Scenario: Lead count
- **WHEN** `SUPER_ADMIN` calls `GET /platform/leads/count`
- **THEN** the response includes the number of `Lead` records that are not soft-deleted (`deletedAt` null)
