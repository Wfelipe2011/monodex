# city-outreach-sends Specification

## Purpose
TBD - created by archiving change city-outreach-send-status. Update Purpose after archive.
## Requirements
### Requirement: City outreach send snapshots template name at Graph acceptance
When city outreach (`contactLeads`) obtains Cloud API HTTP 200 with a message id, the system SHALL persist that id on `TenantLead.messageId` and SHALL persist the catalog template **name** used in that POST on `TenantLead.templateName`. `lastStatus` MUST remain unset until a Meta webhook status arrives for that `wamid`. The system MUST NOT later overwrite `templateName` from the tenant's current outreach config.

#### Scenario: Snapshot on successful send
- **WHEN** `contactLeads` sends template `hello_city` and Graph returns `wamid` W
- **THEN** the created `TenantLead` MUST have `messageId` W and `templateName` `hello_city` and `lastStatus` null

#### Scenario: Later config change does not rewrite snapshot
- **WHEN** the tenant's `outreachTemplateId` is changed after that send
- **THEN** that `TenantLead.templateName` MUST still be `hello_city`

### Requirement: Operators can list city outreach sends without mixing list campaigns
The system SHALL expose city outreach sends (TenantLead rows that have a Cloud API `messageId`) via:

- `GET /tenant/:tenantId/outreach/sends` for tenant `ADMIN` (and `SUPER_ADMIN` GET)
- `GET /platform/tenants/:tenantId/outreach/sends` for `SUPER_ADMIN`

The response MUST include at least: tenant-lead id, `wamid`, `sentAt`, `lastStatus`, `templateName`, recipient `lead.id` / `lead.name` / `lead.phone`. It MUST NOT include list-campaign sends (`TenantListSend`) or list-lead records. At most 100 rows, newest first. Rows without `messageId` (including captura/Baileys contacts) MUST be omitted. Optional query `status=failed` MUST restrict to `lastStatus=failed` and MAY include `latestError` from the latest failed `WhatsappSendStatus` for that `wamid`.

#### Scenario: Admin lists city sends
- **WHEN** an `ADMIN` of tenant 4 calls `GET /tenant/4/outreach/sends`
- **THEN** the response MUST contain only that tenant's city outreach sends with status, template name, and lead name/phone

#### Scenario: Super Admin lists via platform prefix
- **WHEN** `SUPER_ADMIN` calls `GET /platform/tenants/4/outreach/sends`
- **THEN** the response MUST be the same city-send contract for tenant 4

#### Scenario: List campaign sends are absent
- **WHEN** tenant 4 also has `TenantListSend` rows
- **THEN** those rows MUST NOT appear in `/outreach/sends`

#### Scenario: Filter failed city sends
- **WHEN** the client requests `/outreach/sends?status=failed`
- **THEN** only city sends whose `lastStatus` is `failed` MUST be returned, and `latestError` MUST be included when a failed status event exists

#### Scenario: Captura contact is not a send
- **WHEN** a `TenantLead` exists with `messageId` null
- **THEN** that row MUST NOT appear in `/outreach/sends`

### Requirement: City send listing is polling-only
City outreach send listing MUST be a request/response GET. The system MUST NOT require WebSocket or push to observe delivery status updates.

#### Scenario: Status visible after refresh
- **WHEN** a webhook has updated `TenantLead.lastStatus` to `delivered`
- **THEN** a subsequent GET of `/outreach/sends` MUST return `lastStatus` `delivered` for that send

