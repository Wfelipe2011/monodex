## ADDED Requirements

### Requirement: Tenant home aggregates operational snapshot
The system SHALL allow tenant `ADMIN` to retrieve an aggregated home snapshot at `GET /tenant/:tenantId/ops/home`. `SUPER_ADMIN` MUST be allowed to GET the same path (read-only). The response MUST include at least: summed coin `balance` for the tenant; outreach `enabled`; `hasDedicatedNumber` (true only when outreach config points at a non-default platform WhatsApp account); city funnel counts matching `GET /tenant/:tenantId/leads/stats`; inbox `threadCount`, `openWindows` (threads with inbound in the last 24 hours), and `lastInboundAt`; and send-status aggregates for the current and previous calendar days in timezone `America/Sao_Paulo`.

#### Scenario: Admin loads home
- **WHEN** `ADMIN` of tenant 4 calls `GET /tenant/4/ops/home`
- **THEN** the response MUST include coins, outreach flags, city funnel, inbox summary, and `sends.today` / `sends.yesterday`

#### Scenario: Super admin can read home
- **WHEN** `SUPER_ADMIN` GETs `/tenant/4/ops/home`
- **THEN** the API MUST return the snapshot, not HTTP 403 for role

#### Scenario: Dedicated flag false on default
- **WHEN** tenant 4 outreach `whatsappAccountId` is null
- **THEN** `hasDedicatedNumber` MUST be false

### Requirement: Home send counts cover list and city Cloud sends for two local days
`sends.today` and `sends.yesterday` MUST count Cloud API sends belonging to the tenant whose send timestamp falls in that local day: `TenantListSend.sentAt` for that tenant's lists, and `TenantLead.createdAt` where `messageId` is present. Each send MUST increment exactly one of `sent`, `delivered`, `read`, `failed`, or `pending` (`lastStatus` null), plus `total`. `sends.timezone` MUST be `America/Sao_Paulo`. Captura/Baileys `TenantLead` rows without `messageId` MUST NOT be counted. List-campaign and city-outreach sends MUST both be included and MUST NOT be double-counted.

#### Scenario: Today includes city and list
- **WHEN** tenant 4 has one list send delivered today and one city send pending today (local São Paulo)
- **THEN** `sends.today.delivered` MUST be 1, `sends.today.pending` MUST be 1, and `sends.today.total` MUST be 2

#### Scenario: Yesterday isolated from today
- **WHEN** a failed city send occurred yesterday local and none today
- **THEN** `sends.yesterday.failed` MUST be at least 1 and that send MUST NOT increment `sends.today.total`

#### Scenario: Captura excluded
- **WHEN** a `TenantLead` exists with `messageId` null created today
- **THEN** that row MUST NOT increment `sends.today.total`
