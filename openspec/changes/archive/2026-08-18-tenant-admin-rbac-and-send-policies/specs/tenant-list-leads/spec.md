## MODIFIED Requirements

### Requirement: Lead list belongs to tenant
The system SHALL persist a lead list per tenant with at least `name` and `costPerSend` (Float). Each list MUST belong to exactly one tenant. Tenant `ADMIN` SHALL create lists with `name` under `/tenant/:tenantId/lead-lists`; `costPerSend` MUST default to 0 until `SUPER_ADMIN` patches it under `/platform/tenants/:tenantId/lead-lists/:listId`. Admin MUST NOT persist `costPerSend`. Super Admin MUST NOT create additional lists after one exists except inside the bootstrap window for the first list. List-campaign sends MUST NOT run while `costPerSend` is less than or equal to 0.

#### Scenario: Admin creates list
- **WHEN** `ADMIN` posts `{ name }` to `POST /tenant/:tenantId/lead-lists`
- **THEN** a list row is persisted for that tenant with `costPerSend` 0 and returned with generated id

#### Scenario: Super admin sets cost
- **WHEN** `SUPER_ADMIN` patches `{ costPerSend: 0.4 }` on the platform list endpoint
- **THEN** `costPerSend` is persisted and Admin GET includes 0.4 as read-only

#### Scenario: Negative cost rejected
- **WHEN** `SUPER_ADMIN` patches `costPerSend` less than 0
- **THEN** the write MUST be rejected with HTTP 400

### Requirement: List lead mirrors Lead fields except city and rating
The system SHALL persist list leads with at least: `name`, `phone`, optional `website`, optional `category`, optional `reviews` (Int). List leads MUST NOT have `cityId`, `rating`, or `temperature`. They MUST NOT be stored in the global `Lead` table. Create, import, and delete of list leads MUST be tenant `ADMIN` actions on `/tenant/:tenantId/lead-lists/...`.

#### Scenario: Manual create
- **WHEN** `ADMIN` posts a lead with required `name` and `phone` to the list leads endpoint
- **THEN** the lead is persisted on that list only

#### Scenario: Optional category omitted
- **WHEN** a lead is created without `category`
- **THEN** the lead MUST be stored with null category and MUST still be eligible for campaigns subject to other rules

### Requirement: Spreadsheet import contract
The system SHALL accept CSV import with columns `name` (required), `phone` (required), `website` (optional), `category` (optional), `reviews` (optional). Headers MUST be matched case-insensitively after trim. The system MUST provide a downloadable example template at `GET /tenant/:tenantId/lead-lists/:listId/import-template`. Import MUST be a tenant `ADMIN` action.

#### Scenario: Successful import
- **WHEN** `ADMIN` uploads a valid CSV matching the contract
- **THEN** all rows are persisted as list leads and the response summarizes created count

#### Scenario: Invalid row rejected
- **WHEN** a row has empty `name` or invalid `phone`
- **THEN** the import MUST fail with HTTP 400 describing the row error

### Requirement: Category suggestions are informative not restrictive
The system SHALL expose category suggestions derived from distinct categories in global leads and existing list leads, with light normalization for display (case/accent folding). Import MUST persist the category string from the spreadsheet; it MUST NOT require membership in scrape categories. The suggestions endpoint MUST be a tenant `ADMIN` GET on `/tenant/:tenantId/category-suggestions` (or equivalent under the tenant prefix). Super Admin MAY GET the same data.

#### Scenario: New category from import is stored
- **WHEN** import row has `category` value never seen in scrape targets
- **THEN** that string MUST be stored on the list lead

#### Scenario: Suggestions endpoint
- **WHEN** `ADMIN` calls the category suggestions endpoint for their tenant
- **THEN** the response includes distinct category strings suitable for autocomplete
