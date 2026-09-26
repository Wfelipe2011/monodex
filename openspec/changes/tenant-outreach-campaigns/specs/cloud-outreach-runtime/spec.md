## MODIFIED Requirements

### Requirement: Cron selects eligible tenants from database
The Cloud API pool prospecting scheduler SHALL select **campaigns** whose tenant has `Tenant.active` true, master outreach config `enabled` true, campaign `enabled` true, a non-empty tenant phone, positive sufficient **available** coin balance relative to configured `costPerLead` (balance minus reserved pending uncharged city sends × `costPerLead`), and a matching **campaign** schedule window. It MUST NOT hardcode a single tenant id. When multiple campaigns for the same tenant match the same hour, the scheduler MUST process them sequentially in stable campaign id order within that tenant. Tenants with `active=false` or master config disabled MUST skip all pool campaigns.

#### Scenario: Previously hardcoded tenant still works via config
- **WHEN** the tenant that previously was hardcoded (id 8) has master config enabled and a campaign with schedule matching now and `active` true
- **THEN** that campaign MUST be processed by the scheduler

#### Scenario: Second enabled tenant is also processed
- **WHEN** another tenant also has master config enabled, phone, available balance, an enabled campaign with matching schedule, and `active` true
- **THEN** the scheduler MUST process that campaign without code changes to tenant ids

#### Scenario: Disabled master config skipped
- **WHEN** a tenant has master outreach config disabled
- **THEN** the scheduler MUST NOT contact leads for any pool campaign of that tenant

#### Scenario: Inactive tenant skipped
- **WHEN** a tenant has `active=false` and master config enabled with a matching campaign schedule
- **THEN** the scheduler MUST NOT contact leads for that tenant

#### Scenario: Pending reservation blocks overspend
- **WHEN** raw balance covers one lead but one pending uncharged city send already exists for the tenant
- **THEN** the scheduler MUST NOT contact an additional lead for that tenant in that campaign tick beyond affordable capacity

### Requirement: Lead pool remains global with per-tenant usage
The system SHALL continue to treat `Lead` as a shared pool and MUST record per-tenant usage through `TenantLead` when contacting leads, including `outreachCampaignId` of the sending campaign. Coin debit for pool prospecting MUST follow `coin-debit-on-status` (not Graph acceptance alone). Selection MUST apply `TenantSendPolicy` city filters and exclusivity phone exclusions, plus optional campaign `cityId`. List campaign selection MUST NOT use those send policies. After Graph acceptance for pool prospecting, the lead's phone MUST remain excluded for all pool campaigns of that tenant regardless of later Meta `failed` status.

#### Scenario: Contact creates tenant-scoped funnel row
- **WHEN** pool prospecting successfully contacts a lead for tenant T (Graph acceptance)
- **THEN** a `TenantLead` for tenant T MUST exist with the outbound `messageId` and `outreachCampaignId` set

#### Scenario: Coin debit deferred to status trigger
- **WHEN** pool prospecting obtains Graph acceptance for tenant T and the billable status has not yet arrived
- **THEN** coin balance for tenant T MUST NOT yet decrease for that send

#### Scenario: Failed city phone must not be contacted again on pool
- **WHEN** lead L was contacted for tenant T on pool prospecting and the outbound `wamid` later receives status `failed`
- **THEN** tenant T MUST NOT select lead L or any other lead with the same phone through any pool campaign

#### Scenario: Same lead may be used by another tenant if not already bound by product rules
- **WHEN** lead L exists globally and is not yet contacted for tenant U under the current selection rules including send policies
- **THEN** tenant U MAY receive lead L through outreach independently of other tenants' funnel rows unless a send policy excludes that phone

### Requirement: Categories and schedule driven by config
Lead selection categories and send-time windows for a pool run SHALL be read from the **active outreach campaign** record. A lead MUST match when any of its stored `categories` (or `category` if the list is empty) is included in that campaign's configured categories.

#### Scenario: Category filter from campaign
- **WHEN** pool prospecting selects candidate leads for campaign C
- **THEN** only leads whose categories intersect campaign C's configured categories MUST be selected (subject to other existing filters)

#### Scenario: Multi-category lead matches one campaign category
- **WHEN** a lead has `categories` `[Construtoras, Consultorias]` and campaign C lists only `Construtoras`
- **THEN** that lead MUST be eligible on the category dimension

### Requirement: Batch size and header image come from tenant config
Each scheduled run for a pool campaign SHALL contact at most that campaign's `leadsPerRun` unique phones, further capped by `floor(available balance / costPerLead)` for the tenant. Header image parameters SHALL come from the campaign's slot bindings (`header_image` or equivalent variable), not from a dedicated config column or env var.

#### Scenario: Configured batch of ten
- **WHEN** a campaign has `leadsPerRun` 10, sufficient unique unused phones, and tenant balance for at least 10 `costPerLead`
- **THEN** the run MUST attempt at most 10 Cloud API template sends

#### Scenario: Balance caps the batch
- **WHEN** `leadsPerRun` is 10 and available balance covers only 3 leads
- **THEN** the run MUST attempt at most 3 sends

#### Scenario: Header image from binding
- **WHEN** the campaign outreach template has a header image slot bound to `header_image` with an https URL
- **THEN** the template send MUST use that URL in the header image parameter

### Requirement: Sends are spaced by tenant interval
The system SHALL wait the campaign's `sendIntervalSeconds` after each successful or failed template send before starting the next send for **that campaign run**, except after the last send of the run.

#### Scenario: Five second gap
- **WHEN** `sendIntervalSeconds` is 5 and the run sends two templates
- **THEN** at least 5 seconds MUST elapse between the two Cloud API requests

### Requirement: At most one outreach template per phone per tenant
The system MUST NOT send more than one outreach template to the same `phone` for the same tenant through pool prospecting, including leads of that phone in other cities. Candidate selection MUST exclude phones already present in that tenant's pool `TenantLead` rows with a non-null `messageId`. A single run MUST NOT include two leads that share a phone.

#### Scenario: Same phone two cities not double-sent in one run
- **WHEN** two unused leads share phone `P` in cities A and B and both match the campaign categories
- **THEN** the batch MUST contain at most one of them

#### Scenario: Phone already contacted in another city is skipped
- **WHEN** tenant T already has a pool `TenantLead` with `messageId` for phone `P` and another unused lead with phone `P` exists in city B
- **THEN** the city B lead MUST NOT be selected for tenant T on any pool campaign

### Requirement: Cloud sends are built from catalog and bindings
When sending an outreach or notify-tenant template for pool prospecting, the system SHALL load catalog rows referenced by the **sending campaign**, build Graph `components` from parsed slots plus resolved bindings, and for notify after affirmative reply use that same campaign's notify template and `slotBindings.notify`.

#### Scenario: Language from catalog
- **WHEN** the campaign outreach catalog row language is `pt_BR`
- **THEN** the Cloud API template `language.code` MUST be `pt_BR`

#### Scenario: Notify uses campaign bindings not config
- **WHEN** notify-tenant sends after an affirmative reply to a pool send from campaign C
- **THEN** body and button parameters MUST come from campaign C's `slotBindings.notify` resolved against the lead and tenant

### Requirement: City outreach applies send policy in contactLeads
When selecting global leads for a pool campaign run, selection MUST apply `TenantSendPolicy` city allow/deny, optional campaign `cityId`, and MUST exclude phones per exclusivity rules. Own-tenant used phones MUST be excluded per the failed-lock rule above.

#### Scenario: Allowlist filters city
- **WHEN** tenant 4 `allowedCityIds` is `[1]` and unused matching-category leads exist in cities 1 and 2
- **THEN** the batch MUST NOT include city 2 leads

#### Scenario: Campaign city narrows allowlist
- **WHEN** tenant 4 `allowedCityIds` is `[1, 2]` and campaign has `cityId` 1
- **THEN** the batch MUST NOT include city 2 leads

#### Scenario: Exclusive phone excluded
- **WHEN** tenant Y is `exclusive` and contacted phone `P` and tenant X has an unused lead with phone `P`
- **THEN** tenant X MUST NOT select that phone

### Requirement: City outreach persists delivery snapshot fields on TenantLead
When Cloud API accepts a pool prospecting template send, the system SHALL store the returned message id on `TenantLead.messageId`, the sent catalog template name on `TenantLead.templateName`, and `outreachCampaignId`. The system MUST NOT treat Graph HTTP 200 as a Meta delivery status: `lastStatus` MUST stay unset until a webhook `statuses` event for that `wamid` is processed.

#### Scenario: Store wamid and template name after send
- **WHEN** Cloud API accepts an outbound pool message using template `hello_city` from campaign C
- **THEN** the corresponding `TenantLead` MUST have `messageId`, `templateName` `hello_city`, and `outreachCampaignId` for C

#### Scenario: Graph 200 does not set lastStatus
- **WHEN** the send transaction commits after Graph HTTP 200
- **THEN** `TenantLead.lastStatus` MUST be null until a later webhook status arrives

#### Scenario: Notify tenant is not a city send snapshot
- **WHEN** the system sends the notify template to `Tenant.phone` after an affirmative reply
- **THEN** that notify POST MUST NOT create or overwrite a pool send snapshot on the lead's `TenantLead.templateName` / `lastStatus` for the notify `wamid`

### Requirement: Dedicated city outreach template appears on the conversation thread
When pool prospecting obtains Cloud API HTTP 200 with a message id and the tenant's resolved Cloud API account is a dedicated number assigned to that tenant, the system MUST upsert the conversation thread for the lead's phone and persist an outbound conversation message (`type=template`) with that `wamid`.

#### Scenario: Dedicated city send writes conversation
- **WHEN** a pool campaign sends a template for tenant 4 on its dedicated number and Graph returns `wamid` W
- **THEN** a conversation thread for tenant 4 and the lead phone MUST contain an outbound template message with `wamid` W

#### Scenario: Default city send skips conversation
- **WHEN** a pool campaign sends on the platform default number
- **THEN** no `WhatsappConversation` row MUST be created for that send

### Requirement: City outreach sends via the tenant resolved phone number
When contacting a global lead or notifying the tenant after an affirmative reply from a pool send, the system SHALL POST Cloud API messages using credentials resolved for that tenant from outreach config (`whatsappAccountId`).

#### Scenario: Dedicated tenant uses assigned phone
- **WHEN** a pool campaign runs for a tenant whose outreach config points at platform account A
- **THEN** each template send MUST target account A's `phoneNumberId`

#### Scenario: Unassigned tenant uses default phone
- **WHEN** a pool campaign runs for a tenant with `whatsappAccountId` null
- **THEN** each template send MUST target the default platform account phone number id

## ADDED Requirements

### Requirement: Pool runs are keyed by outreach campaign
The system SHALL open at most one OPEN `OutreachSendRun` with channel CITY per `outreachCampaignId` at a time, with `targetCount` equal to that campaign's `leadsPerRun` (subject to affordability). Multiple OPEN CITY runs MAY exist concurrently for the same tenant when they belong to different campaigns.

#### Scenario: Two campaigns same hour
- **WHEN** campaigns A and B for tenant 4 both match the schedule and master config is enabled
- **THEN** each campaign MAY open its own CITY run in the same scheduler tick

#### Scenario: Same campaign cannot double-open
- **WHEN** campaign A already has a non-expired OPEN CITY run
- **THEN** a subsequent tick MUST NOT open a second OPEN run for campaign A until the first closes or expires
