## MODIFIED Requirements

### Requirement: Batch size and header image come from tenant config
Each scheduled run for a tenant SHALL open an `outreach-send-run` city run whose `targetCount` is `leadsPerRun`, and SHALL attempt Graph template sends toward that target, further capped by available balance (`floor(available / costPerLead)`) and eligible unique phones. The initial tick SHOULD obtain up to `targetCount` Graph accepts when possible; Graph failures during the tick MUST trigger same-run refill attempts per `outreach-send-run` (subject to try cap `targetCount * 3`). Header image parameters SHALL come from slot bindings (`header_image` or equivalent variable), not from a dedicated `headerImageUrl` column or `WHATSAPP_OUTREACH_HEADER_IMAGE_URL`. The system MUST NOT hardcode `slice(0, 5)` as the only batch size. The semantic goal of `leadsPerRun` is charged sends for the run (via later status debit), recovered through refill on Graph failure and Meta `failed`.

#### Scenario: Configured batch of ten
- **WHEN** a tenant has `leadsPerRun` 10, sufficient unique unused phones, and balance for at least 10 `costPerLead`, and no open city run blocks the tick
- **THEN** the run MUST attempt to obtain up to 10 Cloud API template accepts in the initial phase

#### Scenario: Balance caps the batch
- **WHEN** `leadsPerRun` is 10 and available balance covers only 3 leads
- **THEN** the initial phase MUST attempt at most 3 sends

#### Scenario: Graph failure refills in same run
- **WHEN** `leadsPerRun` is 5, the initial phase has not yet reached 5 accepts, and one Graph POST fails
- **THEN** the system MUST attempt a replacement lead for the same run after `sendIntervalSeconds` when eligibility allows

#### Scenario: Header image from binding
- **WHEN** the outreach template has a header image slot bound to `header_image` with an https URL
- **THEN** the template send MUST use that URL in the header image parameter
