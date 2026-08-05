# admin-ops-read Specification

## Purpose

Read-only operational aggregations for super admins (summary, funnel stats, global lead pool count).

## Requirements

### Requirement: Platform operations summary
The system SHALL provide a `SUPER_ADMIN`-only summary endpoint aggregating platform operational counts useful for onboarding verification.

#### Scenario: Summary returns key counters
- **WHEN** `SUPER_ADMIN` calls `GET /admin/ops/summary`
- **THEN** the response includes at least: total tenants, active tenants, tenants with outreach enabled, and total leads in the global pool (non-deleted)

### Requirement: Tenant lead funnel stats
The system SHALL allow a `SUPER_ADMIN` to retrieve `TenantLead` funnel counts for a given tenant.

#### Scenario: Funnel stats by tenant
- **WHEN** `SUPER_ADMIN` calls `GET /admin/tenants/:tenantId/leads/stats`
- **THEN** the response includes counts for contacted, replied, quoted, closed, and deleted (or equivalent boolean aggregations on `TenantLead`)

### Requirement: Global lead pool count
The system SHALL allow a `SUPER_ADMIN` to retrieve the count of leads in the global marketplace pool.

#### Scenario: Lead count
- **WHEN** `SUPER_ADMIN` calls `GET /admin/leads/count`
- **THEN** the response includes the number of `Lead` records that are not soft-deleted (`deletedAt` null)
