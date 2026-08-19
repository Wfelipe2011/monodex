## ADDED Requirements

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
