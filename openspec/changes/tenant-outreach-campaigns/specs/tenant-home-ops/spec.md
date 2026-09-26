## MODIFIED Requirements

### Requirement: Home send counts cover list and city Cloud sends for two local days
`sends.today` and `sends.yesterday` MUST count Cloud API sends belonging to the tenant whose send timestamp falls in that local day: `TenantListSend.sentAt` for that tenant's lists, and `TenantLead.createdAt` where `messageId` is present. Each send MUST increment exactly one of `sent`, `delivered`, `read`, `failed`, or `pending` (`lastStatus` null), plus `total`. `sends.timezone` MUST be `America/Sao_Paulo`. Captura/Baileys `TenantLead` rows without `messageId` MUST NOT be counted. List-campaign and pool prospecting sends MUST both be included and MUST NOT be double-counted. The home response MUST also expose optional pool breakdown `sends.byOutreachCampaign` as an array of `{ outreachCampaignId, name, today, yesterday }` with the same status buckets per campaign; when a tenant has no campaigns, the array MUST be empty.

#### Scenario: Today includes city and list
- **WHEN** tenant 4 has one list send delivered today and one pool send pending today (local São Paulo)
- **THEN** `sends.today.delivered` MUST be 1, `sends.today.pending` MUST be 1, and `sends.today.total` MUST be 2

#### Scenario: Breakdown by campaign
- **WHEN** tenant 4 has campaigns A and B and each had one pool send today
- **THEN** `sends.byOutreachCampaign` MUST contain two entries whose `today.total` sum to the pool portion of `sends.today.total`

#### Scenario: Yesterday isolated from today
- **WHEN** a failed pool send occurred yesterday local and none today
- **THEN** `sends.yesterday.failed` MUST be at least 1 and that send MUST NOT increment `sends.today.total`

#### Scenario: Captura excluded
- **WHEN** a `TenantLead` exists with `messageId` null created today
- **THEN** that row MUST NOT increment `sends.today.total`
