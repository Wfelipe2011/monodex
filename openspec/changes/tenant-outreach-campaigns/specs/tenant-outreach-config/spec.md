## MODIFIED Requirements

### Requirement: Outreach configuration exists per tenant
The system SHALL persist one outreach account record per tenant, including at least: master `enabled` flag (pool/city prospecting only), cost per lead, cost per on-demand send, cashback on reply, optional platform `whatsappAccountId` (null means the default platform sender), and `coinDebitOnStatus`. Per-campaign schedule, categories, templates, slot bindings, `leadsPerRun`, and `sendIntervalSeconds` MUST live on `TenantOutreachCampaign`, not on this config. The system MUST NOT persist `outreachTemplateName`, `notifyTenantTemplateName`, `outreachContactText`, or `headerImageUrl` as config columns.

#### Scenario: Config created for tenant
- **WHEN** an outreach config is stored for a tenant
- **THEN** the system MUST associate exactly one config record with that tenant

#### Scenario: Disabled by default for new configs
- **WHEN** a new outreach config is created without an explicit enabled value
- **THEN** pool prospecting MUST be treated as disabled until master `enabled` is set true

#### Scenario: WhatsApp assignment defaults to shared sender
- **WHEN** a new outreach config is created without `whatsappAccountId`
- **THEN** `whatsappAccountId` MUST be null and pool sends MUST use the default platform phone number

#### Scenario: On-demand price defaults to zero
- **WHEN** a new outreach config is created without `costPerOnDemandSend`
- **THEN** `costPerOnDemandSend` MUST be 0

### Requirement: Enabled outreach requires tenant phone
The system SHALL NOT treat a tenant as eligible for pool prospecting when `Tenant.phone` is null or empty, even if master outreach config is enabled and campaigns are enabled.

#### Scenario: Enabled without phone
- **WHEN** outreach config has enabled=true and the tenant has no phone
- **THEN** pool campaign selection MUST be skipped and MUST NOT receive Cloud API sends attributed to that tenant's funnel

#### Scenario: Enabled with phone
- **WHEN** outreach config has enabled=true, the tenant has a non-empty phone, and at least one campaign is enabled with matching schedule
- **THEN** that campaign MAY run subject to balance, template, and binding rules

### Requirement: Pricing and templates come from config
The system SHALL apply the tenant's configured `costPerLead` when a coin debit is due for pool prospecting (per `coin-debit-on-status`). Meta templates for contact and notify-tenant after affirmative reply MUST come from the **campaign** that sent the outbound message (`TenantLead.outreachCampaignId`), using that campaign's template ids and slot bindings. Cashback on affirmative reply MUST use `cashbackOnReply` from this config. The system MUST NOT debit pool prospecting coins solely because Cloud API accepted the send.

#### Scenario: Contact lead uses configured cost when status trigger met
- **WHEN** a pool prospecting send for a tenant reaches the tenant's effective `coinDebitOnStatus`
- **THEN** the system MUST decrement coin balance by that tenant's `costPerLead` and record a matching debit transaction

#### Scenario: Graph accept alone does not debit
- **WHEN** Cloud API accepts a pool prospecting send and no billable status webhook has been applied yet
- **THEN** coin balance MUST remain unchanged for that send

#### Scenario: Reply cashback uses configured amount
- **WHEN** a lead reply is processed as affirmative and cashback is applied
- **THEN** the system MUST credit coins by that tenant's `cashbackOnReply`

#### Scenario: Outreach uses bound catalog template from campaign
- **WHEN** campaign C contacts a lead using `outreachTemplateId` pointing at catalog name `test_gladson`
- **THEN** the Cloud API template `name` MUST be `test_gladson` from that catalog row

### Requirement: Outreach field ownership is split by role
The system SHALL treat `costPerLead`, `costPerOnDemandSend`, `cashbackOnReply`, and `whatsappAccountId` as platform-owned and master `enabled` as tenant-owned on this config. Campaign fields (`enabled`, `schedule`, `categories`, `leadsPerRun`, `sendIntervalSeconds`, `slotBindings`, template ids, `cityId`) MUST be tenant-owned on `TenantOutreachCampaign`. City and exclusivity policies are stored on `TenantSendPolicy`, not as columns of `TenantOutreachConfig`.

#### Scenario: Admin writes master enabled
- **WHEN** `ADMIN` patches `{ enabled: false }` on outreach config
- **THEN** master flag is persisted and `costPerLead` is unchanged

#### Scenario: Admin omitted price on create
- **WHEN** `ADMIN` PUTs a missing outreach config without `costPerLead`
- **THEN** a config row exists with `whatsappAccountId` null and pool prospecting MUST NOT send until Super Admin sets `costPerLead` greater than 0

#### Scenario: Admin cannot patch on-demand price
- **WHEN** `ADMIN` patches `{ costPerOnDemandSend: 0.5 }`
- **THEN** the API responds with HTTP 403 and `costPerOnDemandSend` is unchanged

## REMOVED Requirements

### Requirement: Send knobs are validated
**Reason:** `leadsPerRun` and `sendIntervalSeconds` validation moved to `tenant-outreach-campaigns`.
**Migration:** Clients validate knobs on campaign CRUD instead of outreach config.

### Requirement: Enabling outreach requires approved templates and complete bindings
**Reason:** Template enable rules apply per campaign, not on master config.
**Migration:** Enable templates on each `TenantOutreachCampaign`; master config `enabled` is a pool master switch only.
