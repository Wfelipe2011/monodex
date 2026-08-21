## ADDED Requirements

### Requirement: Dedicated city outreach template appears on the conversation thread
When city outreach (`contactLeads`) obtains Cloud API HTTP 200 with a message id and the tenant's resolved Cloud API account is a dedicated (`isDefault=false`) number assigned to that tenant, the system MUST upsert the conversation thread for the lead's phone and persist an outbound conversation message (`type=template`) with that `wamid`. This MUST NOT replace `TenantLead.messageId` / `templateName` persistence. When the tenant uses the platform default number, the system MUST NOT create a conversation thread for that send.

#### Scenario: Dedicated city send writes conversation
- **WHEN** `contactLeads` sends a template for tenant 4 on its dedicated number and Graph returns `wamid` W
- **THEN** a conversation thread for tenant 4 and the lead phone MUST contain an outbound template message with `wamid` W

#### Scenario: Default city send skips conversation
- **WHEN** `contactLeads` sends on the platform default number
- **THEN** no `WhatsappConversation` row MUST be created for that send
