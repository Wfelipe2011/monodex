# tenant-list-leads Specification

## Purpose
TBD - created by archiving change tenant-list-campaigns-inbox. Update Purpose after archive.
## Requirements
### Requirement: Lead list belongs to tenant
The system SHALL persist a lead list per tenant with at least `name` and `costPerSend` (Float, > 0 when sends are enabled). Each list MUST belong to exactly one tenant.

#### Scenario: Super admin creates list
- **WHEN** `SUPER_ADMIN` posts `{ name, costPerSend }` to `POST /admin/tenants/:tenantId/lead-lists`
- **THEN** a list row is persisted for that tenant and returned with generated id

#### Scenario: Invalid cost rejected
- **WHEN** `costPerSend` is less than or equal to 0
- **THEN** the write MUST be rejected with HTTP 400

### Requirement: List lead mirrors Lead fields except city and rating
The system SHALL persist list leads with at least: `name`, `phone`, optional `website`, optional `category`, optional `reviews` (Int). List leads MUST NOT have `cityId`, `rating`, or `temperature`. They MUST NOT be stored in the global `Lead` table.

#### Scenario: Manual create
- **WHEN** `SUPER_ADMIN` posts a lead with required `name` and `phone` to the list leads endpoint
- **THEN** the lead is persisted on that list only

#### Scenario: Optional category omitted
- **WHEN** a lead is created without `category`
- **THEN** the lead MUST be stored with null category and MUST still be eligible for campaigns subject to other rules

### Requirement: Phone is unique within a list
The system MUST enforce unique `phone` per list (after normalizing to digits with optional `55` prefix). Duplicate phones in manual create, bulk create, or import MUST be rejected.

#### Scenario: Duplicate phone in list rejected
- **WHEN** a lead with phone `P` already exists on list L and another lead with the same normalized phone is submitted
- **THEN** the write MUST be rejected with HTTP 400

#### Scenario: Duplicate phone in import file rejected
- **WHEN** an import file contains two rows with the same normalized phone
- **THEN** the import MUST fail without partial insert

### Requirement: Spreadsheet import contract
The system SHALL accept CSV import with columns `name` (required), `phone` (required), `website` (optional), `category` (optional), `reviews` (optional). Headers MUST be matched case-insensitively after trim. The system MUST provide a downloadable example template at `GET /admin/tenants/:tenantId/lead-lists/:listId/import-template`.

#### Scenario: Successful import
- **WHEN** `SUPER_ADMIN` uploads a valid CSV matching the contract
- **THEN** all rows are persisted as list leads and the response summarizes created count

#### Scenario: Invalid row rejected
- **WHEN** a row has empty `name` or invalid `phone`
- **THEN** the import MUST fail with HTTP 400 describing the row error

### Requirement: Category suggestions are informative not restrictive
The system SHALL expose category suggestions derived from distinct categories in global leads and existing list leads, with light normalization for display (case/accent folding). Import MUST persist the category string from the spreadsheet; it MUST NOT require membership in scrape categories.

#### Scenario: New category from import is stored
- **WHEN** import row has `category` value never seen in scrape targets
- **THEN** that string MUST be stored on the list lead

#### Scenario: Suggestions endpoint
- **WHEN** `SUPER_ADMIN` calls the category suggestions endpoint for a tenant
- **THEN** the response includes distinct category strings suitable for autocomplete

