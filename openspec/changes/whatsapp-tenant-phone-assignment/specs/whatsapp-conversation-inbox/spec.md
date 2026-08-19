## ADDED Requirements

### Requirement: Inbox replies use the tenant resolved Cloud API account
Successful conversation text sends MUST POST to Graph using credentials resolved for the path `tenantId` (dedicated platform number if assigned, otherwise the default). They MUST NOT send from an arbitrary platform `findFirst` account.

#### Scenario: Reply from dedicated number
- **WHEN** `ADMIN` of tenant T posts a reply and T is assigned to platform account A and the 24-hour window is open
- **THEN** the Graph text message MUST use account A's `phoneNumberId`

## MODIFIED Requirements

### Requirement: Super admin can send free-text replies within Meta window
The system SHALL allow tenant `ADMIN` to POST `{ text }` on `/tenant/:tenantId/lead-lists/:listId/leads/:leadId/messages` to send a Cloud API text message to the list lead's phone. The request MUST be rejected with HTTP 400 when no inbound message from that phone exists within the last 24 hours (Meta customer care window). Successful sends MUST use the tenant's resolved platform Cloud API account and persist outbound conversation messages. After the bootstrap window, `SUPER_ADMIN` POST MUST return HTTP 403.

#### Scenario: Send within window
- **WHEN** last inbound from the lead's phone was 2 hours ago and text is non-empty and `ADMIN` of that tenant posts
- **THEN** Graph text message is sent and outbound row is created

#### Scenario: Send outside window rejected
- **WHEN** no inbound from that phone in the last 24 hours
- **THEN** API responds HTTP 400 and MUST NOT call Graph

#### Scenario: Super admin reply after bootstrap rejected
- **WHEN** `SUPER_ADMIN` POSTs a reply and no bootstrap window applies to that conversation resource
- **THEN** the API responds with HTTP 403
