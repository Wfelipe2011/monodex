## MODIFIED Requirements

### Requirement: Operators can list conversation threads
The system SHALL allow tenant `ADMIN` and `SUPER_ADMIN` to `GET /tenant/:tenantId/conversations`. Results MUST be ordered by `lastMessageAt` descending and MUST include at least: thread id, phone, displayName, lastMessageAt, lastInboundAt, `windowOpen` (true when last inbound is within 24 hours), a summary of the latest message, and optional pool prospecting provenance `prospecting` when the tenant has a `TenantLead` with non-null `messageId` for that normalized phone: `outreachCampaignId`, `outreachCampaignName`, and `lastOutreachTemplateName` from the latest such send. Optional query parameters MUST be supported: `q` (case-insensitive match on displayName or phone), `outreachCampaignId`, and `templateName` (matches latest pool send template name on the thread). The response MUST NOT require a list id or city-lead id.

#### Scenario: Admin lists threads
- **WHEN** `ADMIN` of tenant 4 calls `GET /tenant/4/conversations`
- **THEN** the response MUST list that tenant's threads newest-activity first

#### Scenario: Filter by campaign
- **WHEN** `ADMIN` calls `GET /tenant/4/conversations?outreachCampaignId=3`
- **THEN** only threads whose latest pool send belongs to campaign 3 MUST be returned

#### Scenario: Search by name
- **WHEN** `ADMIN` calls `GET /tenant/4/conversations?q=academia`
- **THEN** threads whose displayName or phone contains `academia` (case-insensitive) MUST be returned

#### Scenario: Super admin can list
- **WHEN** `SUPER_ADMIN` GETs `/tenant/4/conversations`
- **THEN** the API MUST return the list (or empty array), not HTTP 403 for role
