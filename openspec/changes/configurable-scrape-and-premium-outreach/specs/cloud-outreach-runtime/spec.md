## MODIFIED Requirements

### Requirement: Categories and schedule driven by config
Lead selection categories and send-time windows for a tenant SHALL be read from that tenant's outreach configuration rather than exclusively from hardcoded literals in application source. A lead MUST match when any of its stored `categories` (or `category` if the list is empty) is included in the tenant's configured categories.

#### Scenario: Category filter from config
- **WHEN** outreach selects candidate leads for a tenant
- **THEN** only leads whose categories intersect that tenant's configured categories MUST be selected (subject to other existing filters retained intentionally)

#### Scenario: Multi-category lead matches one tenant category
- **WHEN** a lead has `categories` `[Construtoras, Consultorias]` and the tenant config lists only `Construtoras`
- **THEN** that lead MUST be eligible on the category dimension

## ADDED Requirements

### Requirement: Website is not an outreach eligibility filter
The system MUST NOT include or exclude leads from outreach based on `website` being empty, social, or a real site.

#### Scenario: Lead with a real website can be selected
- **WHEN** a candidate lead has a non-empty website that is not a social/wix/wa.me URL and otherwise matches tenant filters
- **THEN** the lead MUST remain eligible on the website dimension

### Requirement: Batch size and header image come from tenant config
Each scheduled run for a tenant SHALL contact at most `leadsPerRun` unique phones, further capped by `floor(coin balance / costPerLead)`. The outreach template header image URL SHALL be `headerImageUrl` from the tenant config when set, otherwise `WHATSAPP_OUTREACH_HEADER_IMAGE_URL` if present. The system MUST NOT hardcode `slice(0, 5)` as the only batch size.

#### Scenario: Configured batch of ten
- **WHEN** a tenant has `leadsPerRun` 10, sufficient unique unused phones, and balance for at least 10 `costPerLead`
- **THEN** the run MUST attempt at most 10 Cloud API template sends

#### Scenario: Balance caps the batch
- **WHEN** `leadsPerRun` is 10 and balance covers only 3 leads
- **THEN** the run MUST attempt at most 3 sends

#### Scenario: Header image from tenant
- **WHEN** `headerImageUrl` is set on the tenant config
- **THEN** the template send MUST use that URL in the header image parameter

### Requirement: Sends are spaced by tenant interval
The system SHALL wait `sendIntervalSeconds` after each successful or failed template send before starting the next send for that tenant, except after the last send of the run. The wait MUST also be applied before starting the next tenant in the same scheduler tick, using the interval of the tenant that just finished.

#### Scenario: Five second gap
- **WHEN** `sendIntervalSeconds` is 5 and the run sends two templates
- **THEN** at least 5 seconds MUST elapse between the two Cloud API requests

### Requirement: At most one outreach template per phone per tenant
The system MUST NOT send more than one outreach template to the same `phone` for the same tenant, including leads of that phone in other cities. Candidate selection MUST exclude phones already present in that tenant's `TenantLead` rows. A single run MUST NOT include two leads that share a phone. A successful send MUST create exactly one `TenantLead` for the `leadId` sent.

#### Scenario: Same phone two cities not double-sent in one run
- **WHEN** two unused leads share phone `P` in cities A and B and both match the tenant categories
- **THEN** the batch MUST contain at most one of them

#### Scenario: Phone already contacted in another city is skipped
- **WHEN** tenant T already has a `TenantLead` for a lead with phone `P` in city A and another unused lead with phone `P` exists in city B
- **THEN** the city B lead MUST NOT be selected for tenant T
