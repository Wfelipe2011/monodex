## ADDED Requirements

### Requirement: Outreach field ownership is split by role
The system SHALL treat `costPerLead` and `cashbackOnReply` as platform-owned and `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, and `notifyTemplateId` as tenant-owned. Template ids MUST reference granted catalog rows. City and exclusivity policies are stored on `TenantSendPolicy`, not as columns of `TenantOutreachConfig`.

#### Scenario: Admin writes schedule
- **WHEN** `ADMIN` patches `{ schedule: { "2": [18] } }` on an existing outreach config
- **THEN** schedule is persisted and `costPerLead` is unchanged

#### Scenario: Admin omitted price on create
- **WHEN** `ADMIN` PUTs a missing outreach config without `costPerLead`
- **THEN** a config row exists and city outreach MUST NOT send until Super Admin sets `costPerLead` greater than 0
