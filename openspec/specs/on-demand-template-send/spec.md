# on-demand-template-send Specification

## Purpose

Tenant Admin (JWT or API key) sends a granted APPROVED template to an arbitrary number on the dedicated Cloud API line, billed via `costPerOnDemandSend` on webhook status, with delivery status readable by operators.

## Requirements

### Requirement: Tenant can send a granted template to an arbitrary number
The system SHALL expose `POST /tenant/:tenantId/whatsapp-templates/:templateId/sends` for tenant `ADMIN` (JWT or API key). The body MUST include destination `to` and MAY include `variables` (slot-key to free-text map), optional `imageId` (tenant media public id), and optional `leadId` for resolving `lead.*` bindings. The template MUST be granted to the tenant and `APPROVED`. The send MUST use the tenant's dedicated Cloud API number. Super Admin JWT MUST receive HTTP 403 and MUST NOT call Graph.

#### Scenario: Admin send succeeds
- **WHEN** tenant 4 `ADMIN` posts to a granted APPROVED template with valid `to` and required slots filled, dedicated number assigned, `costPerOnDemandSend` > 0, and sufficient available balance
- **THEN** Graph is called on the dedicated account and HTTP 201 includes `wamid`, `to`, `messageStatus`, send `id`, and `conversationId`

#### Scenario: Super Admin send forbidden
- **WHEN** `SUPER_ADMIN` POSTs the same send path
- **THEN** the API responds with HTTP 403 and MUST NOT call Graph

#### Scenario: Ungranted template rejected
- **WHEN** template 10 is not granted to tenant 4 and `ADMIN` POSTs a send for template 10
- **THEN** the API responds with HTTP 400 or 404 and MUST NOT call Graph

#### Scenario: Shared default number rejected
- **WHEN** tenant 4 has `whatsappAccountId` null and `ADMIN` POSTs an on-demand send
- **THEN** the API responds with HTTP 400 and MUST NOT call Graph

#### Scenario: Zero price rejects send
- **WHEN** `costPerOnDemandSend` is 0 and `ADMIN` POSTs an on-demand send
- **THEN** the API responds with HTTP 400 and MUST NOT call Graph

### Requirement: Slot values are free text plus optional image and lead bindings
When building Graph components, `variables` MUST fill matching slot keys as literal text. When the template requires `header.image`, `imageId` MUST resolve to that tenant's media public URL unless `variables['header.image']` is already a non-empty URL. Optional `leadId` MUST resolve `lead.*` the same way as catalog test-send. Missing required slots MUST return HTTP 400 without calling Graph.

#### Scenario: Free text body
- **WHEN** the template requires `body.1` and the client sends `{ "variables": { "body.1": "João" } }`
- **THEN** the Graph body parameter text MUST be `João`

#### Scenario: Header from media library
- **WHEN** the template requires `header.image` and the client sends `imageId` of a media row belonging to that tenant
- **THEN** Graph header image `link` MUST be the public HTTPS URL for that media

#### Scenario: Missing header image rejected
- **WHEN** the template requires `header.image` and neither `imageId` nor `variables['header.image']` is provided
- **THEN** the API responds with HTTP 400 and MUST NOT call Graph

#### Scenario: Foreign image rejected
- **WHEN** `imageId` belongs to another tenant
- **THEN** the API responds with HTTP 404 or 400 and MUST NOT call Graph

### Requirement: On-demand Graph accept does not debit coins
When Cloud API accepts an on-demand template send (HTTP 200 with `wamid`), the system MUST persist `TenantOnDemandSend` with `coinDebitedAt` null and MUST NOT decrement coin balance at that moment. Debit and refund MUST follow `coin-debit-on-status` using `costPerOnDemandSend`. Preflight failures (inactive tenant, insufficient available balance, missing grant, missing dedicated number, missing media, price ≤ 0) MUST NOT create a billable send and MUST NOT debit.

#### Scenario: Graph 200 without debit
- **WHEN** on-demand send obtains Graph 200
- **THEN** `coinDebitedAt` remains null and coin balance is unchanged until a billable status webhook

#### Scenario: Preflight failure does not debit
- **WHEN** available balance is below `costPerOnDemandSend` at POST time
- **THEN** the API responds with HTTP 400, Graph is not called, and coin balance is unchanged

### Requirement: Operators can read on-demand send delivery status
The system SHALL allow tenant `ADMIN`, `SUPER_ADMIN`, and API key to GET on-demand sends for the tenant, including `lastStatus` and latest error when failed. Listing MUST be newest first and MAY cap at 100 rows.

#### Scenario: Get by id
- **WHEN** `ADMIN` GETs an on-demand send by id after a `delivered` webhook
- **THEN** the response includes `lastStatus=delivered` and the `wamid`

#### Scenario: Super Admin can read
- **WHEN** `SUPER_ADMIN` GETs tenant 4 on-demand sends
- **THEN** the API returns the list (or empty), not 403 for role
