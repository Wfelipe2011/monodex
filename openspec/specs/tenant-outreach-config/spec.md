# tenant-outreach-config Specification

## Purpose

Persist and apply per-tenant outreach settings (enabled, pricing, catalog templates, slot bindings, schedule, categories) for Cloud API outreach eligibility.
## Requirements
### Requirement: Outreach configuration exists per tenant
The system SHALL persist outreach settings per tenant, including at least: enabled flag, cost per lead, cost per on-demand send, cashback on reply, optional platform `whatsappAccountId` (null means the default platform sender), outreach catalog template id, notify-tenant catalog template id, slot bindings JSON, schedule, eligible categories, leads per run, and send interval seconds. The system MUST NOT persist `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, or `headerImageUrl` as config columns.

#### Scenario: Config created for tenant
- **WHEN** an outreach config is stored for a tenant
- **THEN** the system MUST associate exactly one config record with that tenant

#### Scenario: Disabled by default for new configs
- **WHEN** a new outreach config is created without an explicit enabled value
- **THEN** outreach MUST be treated as disabled until enabled is set true

#### Scenario: Send knobs default when omitted
- **WHEN** a new outreach config is created without `leadsPerRun` or `sendIntervalSeconds`
- **THEN** `leadsPerRun` MUST be 5 and `sendIntervalSeconds` MUST be 5

#### Scenario: WhatsApp assignment defaults to shared sender
- **WHEN** a new outreach config is created without `whatsappAccountId`
- **THEN** `whatsappAccountId` MUST be null and sends MUST use the default platform phone number

#### Scenario: On-demand price defaults to zero
- **WHEN** a new outreach config is created without `costPerOnDemandSend`
- **THEN** `costPerOnDemandSend` MUST be 0

### Requirement: Enabled outreach requires tenant phone
The system SHALL NOT treat a tenant as eligible for outreach when `Tenant.phone` is null or empty, even if the outreach config is enabled.

#### Scenario: Enabled without phone
- **WHEN** outreach config has enabled=true and the tenant has no phone
- **THEN** the tenant MUST be skipped by outreach selection and MUST NOT receive Cloud API sends attributed to that tenant's funnel

#### Scenario: Enabled with phone
- **WHEN** outreach config has enabled=true and the tenant has a non-empty phone
- **THEN** the tenant MUST be eligible for outreach selection subject to balance, schedule, template, and binding rules

### Requirement: Pricing and templates come from config
The system SHALL apply the tenant's configured cost per lead when a coin debit is due for city outreach (per `coin-debit-on-status`) and SHALL select Meta templates from the tenant's outreach catalog template id (lead contact) and notify catalog template id (tenant notification), applying that config's slot bindings. The system MUST NOT debit city outreach coins solely because Cloud API accepted the send.

#### Scenario: Contact lead uses configured cost when status trigger met
- **WHEN** a city outreach send for a tenant reaches the tenant's effective `coinDebitOnStatus`
- **THEN** the system MUST decrement coin balance by that tenant's `costPerLead` and record a matching debit transaction

#### Scenario: Graph accept alone does not debit
- **WHEN** Cloud API accepts a city outreach send and no billable status webhook has been applied yet
- **THEN** coin balance MUST remain unchanged for that send

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
The system SHALL treat `costPerLead`, `costPerOnDemandSend`, `cashbackOnReply`, and `whatsappAccountId` as platform-owned and `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, and `notifyTemplateId` as tenant-owned. Template ids MUST reference granted catalog rows. City and exclusivity policies are stored on `TenantSendPolicy`, not as columns of `TenantOutreachConfig`.

#### Scenario: Admin writes schedule
- **WHEN** `ADMIN` patches `{ schedule: { "2": [18] } }` on an existing outreach config
- **THEN** schedule is persisted and `costPerLead` is unchanged

#### Scenario: Admin omitted price on create
- **WHEN** `ADMIN` PUTs a missing outreach config without `costPerLead`
- **THEN** a config row exists with `whatsappAccountId` null and city outreach MUST NOT send until Super Admin sets `costPerLead` greater than 0

#### Scenario: Admin cannot patch on-demand price
- **WHEN** `ADMIN` patches `{ costPerOnDemandSend: 0.5 }`
- **THEN** the API responds with HTTP 403 and `costPerOnDemandSend` is unchanged

