## MODIFIED Requirements

### Requirement: Outreach configuration exists per tenant
The system SHALL persist outreach settings per tenant, including at least: enabled flag, cost per lead, cashback on reply, coin debit trigger (`coinDebitOnStatus`: `sent` | `delivered` | `read`, default `delivered`), outreach catalog template id, notify-tenant catalog template id, slot bindings JSON, schedule, eligible categories, leads per run, and send interval seconds. The system MUST NOT persist `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, or `headerImageUrl` as config columns.

#### Scenario: Config created for tenant
- **WHEN** an outreach config is stored for a tenant
- **THEN** the system MUST associate exactly one config record with that tenant

#### Scenario: Disabled by default for new configs
- **WHEN** a new outreach config is created without an explicit enabled value
- **THEN** outreach MUST be treated as disabled until enabled is set true

#### Scenario: Send knobs default when omitted
- **WHEN** a new outreach config is created without `leadsPerRun` or `sendIntervalSeconds`
- **THEN** `leadsPerRun` MUST be 5 and `sendIntervalSeconds` MUST be 5

#### Scenario: Coin debit trigger defaults to delivered
- **WHEN** a new outreach config is created without `coinDebitOnStatus`
- **THEN** `coinDebitOnStatus` MUST be `delivered`

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

### Requirement: Outreach field ownership is split by role
The system SHALL treat `costPerLead`, `cashbackOnReply`, and `coinDebitOnStatus` as platform-owned and `enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, `outreachTemplateId`, and `notifyTemplateId` as tenant-owned. Template ids MUST reference granted catalog rows. City and exclusivity policies are stored on `TenantSendPolicy`, not as columns of `TenantOutreachConfig`.

#### Scenario: Admin writes schedule
- **WHEN** `ADMIN` patches `{ schedule: { "2": [18] } }` on an existing outreach config
- **THEN** schedule is persisted and `costPerLead` is unchanged

#### Scenario: Admin omitted price on create
- **WHEN** `ADMIN` PUTs a missing outreach config without `costPerLead`
- **THEN** a config row exists and city outreach MUST NOT send until Super Admin sets `costPerLead` greater than 0

#### Scenario: Admin cannot patch coin debit trigger
- **WHEN** tenant `ADMIN` attempts to write `coinDebitOnStatus`
- **THEN** the write MUST be rejected or the field ignored such that only Super Admin can change it

#### Scenario: Super Admin patches coin debit trigger
- **WHEN** `SUPER_ADMIN` patches `{ coinDebitOnStatus: "sent" }` on platform outreach config
- **THEN** the value is persisted for that tenant
