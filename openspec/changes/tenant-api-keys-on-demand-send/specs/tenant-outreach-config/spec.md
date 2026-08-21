## MODIFIED Requirements

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
