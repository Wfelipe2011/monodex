## MODIFIED Requirements

### Requirement: Batch size and header image come from tenant config
Each scheduled run for a tenant SHALL contact at most `leadsPerRun` unique phones, further capped by `floor(coin balance / costPerLead)`. Header image parameters SHALL come from slot bindings (`header_image` or equivalent variable), not from a dedicated `headerImageUrl` column or `WHATSAPP_OUTREACH_HEADER_IMAGE_URL`. The system MUST NOT hardcode `slice(0, 5)` as the only batch size.

#### Scenario: Configured batch of ten
- **WHEN** a tenant has `leadsPerRun` 10, sufficient unique unused phones, and balance for at least 10 `costPerLead`
- **THEN** the run MUST attempt at most 10 Cloud API template sends

#### Scenario: Balance caps the batch
- **WHEN** `leadsPerRun` is 10 and balance covers only 3 leads
- **THEN** the run MUST attempt at most 3 sends

#### Scenario: Header image from binding
- **WHEN** the outreach template has a header image slot bound to `header_image` with an https URL
- **THEN** the template send MUST use that URL in the header image parameter

## REMOVED Requirements

### Requirement: Outreach template body uses configured contact text
**Reason:** Body parameters are produced from catalog slots and `slotBindings`, not a single `outreachContactText` column.
**Migration:** Bind the body slot to `literal` (or another allowed type) on the outreach config.

## ADDED Requirements

### Requirement: Cloud sends are built from catalog and bindings
When sending an outreach or notify-tenant template, the system SHALL load the catalog row referenced by the config, use that row's `name` and `language`, and build Graph `components` from parsed slots plus resolved bindings. The system MUST NOT hardcode `pt_BR`, positional body-only, or named notify parameter names in the send path. If a required literal/`header_image` binding value is empty, the system MUST NOT POST that template. Notify MUST NOT read `WHATSAPP_NOTIFY_CUSTOMER_LEAD`.

#### Scenario: Language from catalog
- **WHEN** the outreach catalog row language is `pt_BR`
- **THEN** the Cloud API template `language.code` MUST be `pt_BR`

#### Scenario: Notify uses bindings not env
- **WHEN** notify-tenant sends after an affirmative reply
- **THEN** body and button parameters MUST come from `slotBindings.notify` resolved against the lead and tenant
