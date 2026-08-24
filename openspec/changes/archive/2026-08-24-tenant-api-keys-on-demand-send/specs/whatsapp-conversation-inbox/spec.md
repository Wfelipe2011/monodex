## ADDED Requirements

### Requirement: On-demand template sends on dedicated number create conversation threads
When an on-demand template send is accepted by Cloud API (HTTP 200 with `wamid`) on the tenant's dedicated number, the system MUST upsert the conversation thread for the destination phone and persist an outbound conversation message with `type=template` and that `wamid`. Display name MAY start as the normalized phone until inbound profile name arrives.

#### Scenario: On-demand outbound stored
- **WHEN** tenant 4 Admin or API key successfully sends a granted template to phone P on the dedicated number
- **THEN** a thread for `(tenant 4, P)` exists and an `OUT` `type=template` message with the Graph `wamid` is stored

### Requirement: API key may post conversation replies as tenant Admin
The system SHALL allow a valid API key for the tenant to POST free-text on `/tenant/:tenantId/conversations/:conversationId/messages` under the same Meta 24h window and dedicated-number rules as tenant `ADMIN` JWT. Super Admin JWT POST MUST remain HTTP 403.

#### Scenario: API key reply within window
- **WHEN** last inbound was 2 hours ago and a valid API key posts non-empty text
- **THEN** Graph text is sent and an outbound conversation row is created

#### Scenario: Super Admin still cannot reply
- **WHEN** `SUPER_ADMIN` POSTs a conversation reply
- **THEN** the API responds with HTTP 403
