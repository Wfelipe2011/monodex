## ADDED Requirements

### Requirement: City outreach sends via the tenant resolved phone number
When contacting a global lead or notifying the tenant after an affirmative reply, the system SHALL POST Cloud API messages using credentials resolved for that tenant (dedicated platform `phoneNumberId` if `whatsappAccountId` is set, otherwise the default platform account). The system MUST NOT use `findFirst` of an arbitrary enabled platform account as the sender.

#### Scenario: Dedicated tenant uses assigned phone
- **WHEN** `contactLeads` runs for a tenant whose outreach config points at platform account A
- **THEN** each template send MUST target `https://graph.facebook.com/v23.0/{A.phoneNumberId}/messages`

#### Scenario: Unassigned tenant uses default phone
- **WHEN** `contactLeads` runs for a tenant with `whatsappAccountId` null
- **THEN** each template send MUST target the default platform account phone number id
