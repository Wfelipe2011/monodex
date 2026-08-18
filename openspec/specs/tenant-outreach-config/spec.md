# tenant-outreach-config Specification

## Purpose

Persist and apply per-tenant outreach settings (enabled, pricing, catalog templates, slot bindings, schedule, categories) for Cloud API outreach eligibility.

## Requirements

### Requirement: Outreach configuration exists per tenant
The system SHALL persist outreach settings per tenant, including at least: enabled flag, cost per lead, cashback on reply, outreach catalog template id, notify-tenant catalog template id, slot bindings JSON, schedule, eligible categories, leads per run, and send interval seconds. The system MUST NOT persist `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, or `headerImageUrl` as config columns.

#### Scenario: Config created for tenant
- **WHEN** an outreach config is stored for a tenant
- **THEN** the system MUST associate exactly one config record with that tenant

#### Scenario: Disabled by default for new configs
- **WHEN** a new outreach config is created without an explicit enabled value
- **THEN** outreach MUST be treated as disabled until enabled is set true

#### Scenario: Send knobs default when omitted
- **WHEN** a new outreach config is created without `leadsPerRun` or `sendIntervalSeconds`
- **THEN** `leadsPerRun` MUST be 5 and `sendIntervalSeconds` MUST be 5

### Requirement: Enabled outreach requires tenant phone
The system SHALL NOT treat a tenant as eligible for outreach when `Tenant.phone` is null or empty, even if the outreach config is enabled.

#### Scenario: Enabled without phone
- **WHEN** outreach config has enabled=true and the tenant has no phone
- **THEN** the tenant MUST be skipped by outreach selection and MUST NOT receive Cloud API sends attributed to that tenant's funnel

#### Scenario: Enabled with phone
- **WHEN** outreach config has enabled=true and the tenant has a non-empty phone
- **THEN** the tenant MUST be eligible for outreach selection subject to balance, schedule, template, and binding rules

### Requirement: Pricing and templates come from config
The system SHALL debit coins using the tenant's configured cost per lead and SHALL select Meta templates from the tenant's outreach catalog template id (lead contact) and notify catalog template id (tenant notification), applying that config's slot bindings.

#### Scenario: Contact lead uses configured cost
- **WHEN** a lead is successfully contacted for a tenant via Cloud API
- **THEN** the system MUST decrement coin balance by that tenant's `costPerLead` and record a matching debit transaction

#### Scenario: Reply cashback uses configured amount
- **WHEN** a lead reply is processed as affirmative and cashback is applied
- **THEN** the system MUST credit coins by that tenant's `cashbackOnReply`

#### Scenario: Outreach uses bound catalog template
- **WHEN** outreach contacts a lead for a tenant whose `outreachTemplateId` points at catalog name `test_gladson`
- **THEN** the Cloud API template `name` MUST be `test_gladson` from that catalog row

### Requirement: Send knobs are validated
The system SHALL reject outreach config writes when `leadsPerRun` is less than 1 or `sendIntervalSeconds` is less than 0.

#### Scenario: Zero leads per run rejected
- **WHEN** a client sets `leadsPerRun` to 0
- **THEN** the write MUST be rejected

#### Scenario: Negative interval rejected
- **WHEN** a client sets `sendIntervalSeconds` to -1
- **THEN** the write MUST be rejected

### Requirement: Enabling outreach requires approved templates and complete bindings
The system SHALL reject `enabled=true` unless both catalog FKs are set, both templates are `APPROVED`, and every required slot of each template has a binding under the matching role key.

#### Scenario: Enable without outreach template rejected
- **WHEN** `SUPER_ADMIN` sets `enabled` true and `outreachTemplateId` is null
- **THEN** the write MUST be rejected

#### Scenario: Incomplete bindings rejected
- **WHEN** the outreach template requires `body.1` and `slotBindings.outreach` omits `body.1`
- **THEN** the write MUST be rejected

### Requirement: Outreach field ownership is split by role
The system SHALL treat `costPerLead` and `cashbackOnReply` as platform-owned and `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, and `notifyTemplateId` as tenant-owned. Template ids MUST reference granted catalog rows. City and exclusivity policies are stored on `TenantSendPolicy`, not as columns of `TenantOutreachConfig`.

#### Scenario: Admin writes schedule
- **WHEN** `ADMIN` patches `{ schedule: { "2": [18] } }` on an existing outreach config
- **THEN** schedule is persisted and `costPerLead` is unchanged

#### Scenario: Admin omitted price on create
- **WHEN** `ADMIN` PUTs a missing outreach config without `costPerLead`
- **THEN** a config row exists and city outreach MUST NOT send until Super Admin sets `costPerLead` greater than 0
