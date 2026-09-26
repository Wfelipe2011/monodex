## MODIFIED Requirements

### Requirement: City outreach send snapshots template name at Graph acceptance
When pool prospecting (`contactLeads` for a campaign) obtains Cloud API HTTP 200 with a message id, the system SHALL persist that id on `TenantLead.messageId`, the catalog template **name** on `TenantLead.templateName`, and `outreachCampaignId`. `lastStatus` MUST remain unset until a Meta webhook status arrives for that `wamid`. The system MUST NOT later overwrite `templateName` from the tenant's current campaign template config.

#### Scenario: Snapshot on successful send
- **WHEN** a pool campaign sends template `hello_city` and Graph returns `wamid` W
- **THEN** the created `TenantLead` MUST have `messageId` W, `templateName` `hello_city`, `outreachCampaignId` set, and `lastStatus` null

#### Scenario: Later campaign template change does not rewrite snapshot
- **WHEN** the campaign's `outreachTemplateId` is changed after that send
- **THEN** that `TenantLead.templateName` MUST still be `hello_city`

### Requirement: Operators can list city outreach sends without mixing list campaigns
The system SHALL expose pool prospecting sends (TenantLead rows that have a Cloud API `messageId`) via:

- `GET /tenant/:tenantId/outreach/sends` for tenant `ADMIN` (and `SUPER_ADMIN` GET)
- `GET /platform/tenants/:tenantId/outreach/sends` for `SUPER_ADMIN`

The response MUST include at least: tenant-lead id, `wamid`, `sentAt`, `lastStatus`, `templateName`, `outreachCampaignId`, `outreachCampaignName`, recipient `lead.id` / `lead.name` / `lead.phone`. It MUST NOT include list-campaign sends. At most 100 rows, newest first. Optional query `status=failed` MUST restrict to `lastStatus=failed`. Optional query `outreachCampaignId` MUST restrict to sends from that campaign. When `outreachCampaignId` is omitted, sends from all pool campaigns MUST be included.

#### Scenario: Admin lists city sends
- **WHEN** an `ADMIN` of tenant 4 calls `GET /tenant/4/outreach/sends`
- **THEN** the response MUST contain only that tenant's pool sends with status, template name, campaign id/name, and lead name/phone

#### Scenario: Filter by campaign
- **WHEN** an `ADMIN` calls `GET /tenant/4/outreach/sends?outreachCampaignId=12`
- **THEN** only sends with `outreachCampaignId` 12 MUST be returned

#### Scenario: Super Admin lists via platform prefix
- **WHEN** `SUPER_ADMIN` calls `GET /platform/tenants/4/outreach/sends`
- **THEN** the response MUST be the same contract for tenant 4

#### Scenario: List campaign sends are absent
- **WHEN** tenant 4 also has `TenantListSend` rows
- **THEN** those rows MUST NOT appear in `/outreach/sends`

#### Scenario: Filter failed city sends
- **WHEN** the client requests `/outreach/sends?status=failed`
- **THEN** only sends whose `lastStatus` is `failed` MUST be returned, and `latestError` MUST be included when a failed status event exists

#### Scenario: Captura contact is not a send
- **WHEN** a `TenantLead` exists with `messageId` null
- **THEN** that row MUST NOT appear in `/outreach/sends`
