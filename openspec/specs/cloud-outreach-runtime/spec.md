# cloud-outreach-runtime Specification

## Purpose

Run multi-tenant Cloud API outreach from database config: eligible tenants, global lead pool with per-tenant usage, and Meta message-id correlation.
## Requirements
### Requirement: Cron selects eligible tenants from database
The Cloud API outreach scheduler SHALL select tenants that have `Tenant.active` true, outreach enabled, a non-empty phone, positive sufficient **available** coin balance relative to configured cost (balance minus reserved pending uncharged city sends × `costPerLead`), and a matching schedule window. It MUST NOT hardcode a single tenant id as the sole eligible tenant. Tenants with `active=false` MUST be skipped even if outreach is enabled.

#### Scenario: Previously hardcoded tenant still works via config
- **WHEN** the tenant that previously was hardcoded (id 8) has outreach config enabled with schedule matching now and `active` true
- **THEN** that tenant MUST still be processed by the scheduler

#### Scenario: Second enabled tenant is also processed
- **WHEN** another tenant also has outreach enabled, phone, available balance, matching schedule, and `active` true
- **THEN** the scheduler MUST process that tenant without code changes to tenant ids

#### Scenario: Disabled tenant skipped
- **WHEN** a tenant has outreach config disabled
- **THEN** the scheduler MUST NOT contact leads for that tenant

#### Scenario: Inactive tenant skipped
- **WHEN** a tenant has `active=false` and outreach enabled with a matching schedule
- **THEN** the scheduler MUST NOT contact leads for that tenant

#### Scenario: Pending reservation blocks overspend
- **WHEN** raw balance covers one lead but one pending uncharged city send already exists
- **THEN** the scheduler MUST NOT contact an additional lead for that tenant

### Requirement: Lead pool remains global with per-tenant usage
The system SHALL continue to treat `Lead` as a shared pool and MUST record per-tenant usage through `TenantLead` when contacting leads. Coin debit for city outreach MUST follow `coin-debit-on-status` (not Graph acceptance alone). Selection MUST also apply `TenantSendPolicy` city filters and exclusivity phone exclusions. List campaign selection MUST NOT use those send policies. Phones whose only city sends for the tenant ended in `failed` MUST remain eligible for new city outreach for that tenant.

#### Scenario: Contact creates tenant-scoped funnel row
- **WHEN** outreach successfully contacts a lead for tenant T (Graph acceptance)
- **THEN** a `TenantLead` for tenant T MUST exist/be updated with the outbound `messageId`

#### Scenario: Coin debit deferred to status trigger
- **WHEN** outreach obtains Graph acceptance for tenant T and the billable status has not yet arrived
- **THEN** coin balance for tenant T MUST NOT yet decrease for that send

#### Scenario: Failed city phone may be contacted again
- **WHEN** lead L was contacted for tenant T and the outbound `wamid` later receives status `failed`
- **THEN** tenant T MAY receive lead L again through city outreach selection

#### Scenario: Same lead may be used by another tenant if not already bound by product rules
- **WHEN** lead L exists globally and is not yet contacted for tenant U under the current selection rules including send policies
- **THEN** tenant U MAY receive lead L through outreach independently of other tenants' funnel rows unless a send policy excludes that phone

### Requirement: Meta message id correlation
The system SHALL store the Cloud API outbound message id on `TenantLead.messageId` and SHALL use webhook `context.id` to correlate affirmative replies. `messageId` is a Meta correlation identifier and MUST NOT be modeled as a foreign key to the local `Message` table in this change.

#### Scenario: Store wamid after send
- **WHEN** Cloud API accepts an outbound outreach message
- **THEN** the corresponding `TenantLead.messageId` MUST be set to the returned message id

#### Scenario: Correlate reply
- **WHEN** a webhook message includes `context.id` matching a `TenantLead.messageId`
- **THEN** the system MUST update that tenant lead's reply funnel fields accordingly

### Requirement: Categories and schedule driven by config
Lead selection categories and send-time windows for a tenant SHALL be read from that tenant's outreach configuration rather than exclusively from hardcoded literals in application source. A lead MUST match when any of its stored `categories` (or `category` if the list is empty) is included in the tenant's configured categories.

#### Scenario: Category filter from config
- **WHEN** outreach selects candidate leads for a tenant
- **THEN** only leads whose categories intersect that tenant's configured categories MUST be selected (subject to other existing filters retained intentionally)

#### Scenario: Multi-category lead matches one tenant category
- **WHEN** a lead has `categories` `[Construtoras, Consultorias]` and the tenant config lists only `Construtoras`
- **THEN** that lead MUST be eligible on the category dimension

### Requirement: Website is not an outreach eligibility filter
The system MUST NOT include or exclude leads from outreach based on `website` being empty, social, or a real site.

#### Scenario: Lead with a real website can be selected
- **WHEN** a candidate lead has a non-empty website that is not a social/wix/wa.me URL and otherwise matches tenant filters
- **THEN** the lead MUST remain eligible on the website dimension

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

### Requirement: Cloud sends are built from catalog and bindings
When sending an outreach or notify-tenant template, the system SHALL load the catalog row referenced by the config, use that row's `name` and `language`, and build Graph `components` from parsed slots plus resolved bindings. The system MUST NOT hardcode `pt_BR`, positional body-only, or named notify parameter names in the send path. If a required literal/`header_image` binding value is empty, the system MUST NOT POST that template. Notify MUST NOT read `WHATSAPP_NOTIFY_CUSTOMER_LEAD`.

#### Scenario: Language from catalog
- **WHEN** the outreach catalog row language is `pt_BR`
- **THEN** the Cloud API template `language.code` MUST be `pt_BR`

#### Scenario: Notify uses bindings not env
- **WHEN** notify-tenant sends after an affirmative reply
- **THEN** body and button parameters MUST come from `slotBindings.notify` resolved against the lead and tenant

### Requirement: City outreach applies send policy in contactLeads
When selecting global leads for a tenant, `contactLeads` MUST apply `TenantSendPolicy` city allow/deny and MUST exclude phones with `TenantLead.contacted=true` for respected tenants (pairwise, `respectAllTenants`, and other tenants with `exclusive=true`), across cities. Own-tenant used phones MUST remain excluded as today.

#### Scenario: Allowlist filters city
- **WHEN** tenant 4 allowedCityIds is `[1]` and unused matching-category leads exist in cities 1 and 2
- **THEN** the batch MUST NOT include city 2 leads

#### Scenario: Exclusive phone excluded
- **WHEN** tenant Y is `exclusive` and contacted phone `P` and tenant X has an unused lead with phone `P`
- **THEN** tenant X MUST NOT select that phone

### Requirement: City outreach persists delivery snapshot fields on TenantLead
When Cloud API accepts a city outreach template send, the system SHALL store the returned message id on `TenantLead.messageId` and SHALL store the sent catalog template name on `TenantLead.templateName`. The system MUST NOT treat Graph HTTP 200 as a Meta delivery status: `lastStatus` MUST stay unset until a webhook `statuses` event for that `wamid` is processed. Notify-tenant sends after an affirmative reply are unchanged by this requirement (no city-send row for the notify `wamid`).

#### Scenario: Store wamid and template name after send
- **WHEN** Cloud API accepts an outbound city outreach message using template `hello_city`
- **THEN** the corresponding `TenantLead` MUST have `messageId` equal to the returned message id and `templateName` equal to `hello_city`

#### Scenario: Graph 200 does not set lastStatus
- **WHEN** the send transaction commits after Graph HTTP 200
- **THEN** `TenantLead.lastStatus` MUST be null until a later webhook status arrives

#### Scenario: Notify tenant is not a city send snapshot
- **WHEN** the system sends the notify template to `Tenant.phone` after “Tenho Interesse!”
- **THEN** that notify POST MUST NOT create or overwrite a city-outreach send snapshot on the lead's `TenantLead.templateName` / `lastStatus` for the notify `wamid`

### Requirement: Dedicated city outreach template appears on the conversation thread
When city outreach (`contactLeads`) obtains Cloud API HTTP 200 with a message id and the tenant's resolved Cloud API account is a dedicated (`isDefault=false`) number assigned to that tenant, the system MUST upsert the conversation thread for the lead's phone and persist an outbound conversation message (`type=template`) with that `wamid`. This MUST NOT replace `TenantLead.messageId` / `templateName` persistence. When the tenant uses the platform default number, the system MUST NOT create a conversation thread for that send.

#### Scenario: Dedicated city send writes conversation
- **WHEN** `contactLeads` sends a template for tenant 4 on its dedicated number and Graph returns `wamid` W
- **THEN** a conversation thread for tenant 4 and the lead phone MUST contain an outbound template message with `wamid` W

#### Scenario: Default city send skips conversation
- **WHEN** `contactLeads` sends on the platform default number
- **THEN** no `WhatsappConversation` row MUST be created for that send

### Requirement: City outreach sends via the tenant resolved phone number
When contacting a global lead or notifying the tenant after an affirmative reply, the system SHALL POST Cloud API messages using credentials resolved for that tenant (dedicated platform `phoneNumberId` if `whatsappAccountId` is set, otherwise the default platform account). The system MUST NOT use `findFirst` of an arbitrary enabled platform account as the sender.

#### Scenario: Dedicated tenant uses assigned phone
- **WHEN** `contactLeads` runs for a tenant whose outreach config points at platform account A
- **THEN** each template send MUST target `https://graph.facebook.com/v23.0/{A.phoneNumberId}/messages`

#### Scenario: Unassigned tenant uses default phone
- **WHEN** `contactLeads` runs for a tenant with `whatsappAccountId` null
- **THEN** each template send MUST target the default platform account phone number id

