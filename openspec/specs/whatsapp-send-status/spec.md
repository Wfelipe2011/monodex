# whatsapp-send-status Specification

## Purpose

Persist Meta webhook delivery statuses as append-only events, linking each `wamid` to exactly one of city, list, or on-demand send without mixing conversation inbox content.
## Requirements
### Requirement: Send statuses are append-only events
The system SHALL persist each Meta webhook `statuses` event as its own row with at least: outbound `wamid`, `status` (`sent`, `delivered`, `read`, `failed`), Meta timestamp, optional `recipientId`, optional error JSON for `failed`, optional link to `TenantListSend`, optional link to `TenantLead`, and optional link to `TenantOnDemandSend`. Multiple status rows MAY exist for the same `wamid` over time. A city-outreach `wamid` MUST set `tenantLeadId` and MUST NOT set `listSendId` or `onDemandSendId` solely because of that match. A list-campaign `wamid` MUST set `listSendId` and MUST NOT set `tenantLeadId` or `onDemandSendId` solely because of that match. An on-demand `wamid` MUST set `onDemandSendId` and MUST NOT set `tenantLeadId` or `listSendId` solely because of that match.

#### Scenario: Delivered status recorded
- **WHEN** webhook posts `statuses` with `status=delivered` for `wamid` W
- **THEN** a status row for W with `delivered` MUST be inserted

#### Scenario: Failed includes errors
- **WHEN** webhook posts `status=failed` with error details
- **THEN** the status row MUST store error payload JSON

#### Scenario: City wamid links TenantLead only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantLead.messageId` and no `TenantListSend` and no `TenantOnDemandSend`
- **THEN** the status row MUST have `tenantLeadId` set and `listSendId` null and `onDemandSendId` null

#### Scenario: List wamid links TenantListSend only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantListSend.wamid` and no `TenantLead.messageId` and no `TenantOnDemandSend`
- **THEN** the status row MUST have `listSendId` set and `tenantLeadId` null and `onDemandSendId` null

#### Scenario: On-demand wamid links TenantOnDemandSend only
- **WHEN** webhook posts a status for `wamid` W that matches `TenantOnDemandSend.wamid` and no city or list send
- **THEN** the status row MUST have `onDemandSendId` set and `tenantLeadId` null and `listSendId` null

### Requirement: Failed status unlocks list lead for other campaigns
When a `failed` status is recorded for a list campaign outbound `wamid`, the system MUST clear the list lead send lock so other campaigns on the same list MAY target that lead again. Coin refund for that send MUST follow `coin-debit-on-status`.

#### Scenario: Unlock on failed
- **WHEN** failed status arrives for send S tied to list lead L
- **THEN** L MUST no longer be locked by S's campaign

#### Scenario: Unlock and refund together
- **WHEN** failed status arrives for a previously debited list send
- **THEN** the lead is unlocked and a credit is recorded once

### Requirement: Super admin can query sends and failures
The system SHALL expose list campaign sends with aggregated latest status for `SUPER_ADMIN`, filterable by `status=failed`, suitable for a front-end failed-deliveries view.

#### Scenario: Filter failed sends
- **WHEN** `SUPER_ADMIN` requests sends for list L with `status=failed`
- **THEN** only sends whose latest Meta status is `failed` MUST be returned

### Requirement: Status storage is separate from conversation inbox
Delivery status rows MUST NOT replace or duplicate conversation message content. Conversation API history MUST NOT require reading status tables.

#### Scenario: Inbox without status
- **WHEN** client fetches conversation messages for a lead
- **THEN** response MUST be satisfiable from conversation message rows alone

### Requirement: Status persistence triggers coin debit or refund
After the system inserts a `WhatsappSendStatus` row and updates the correlated `TenantListSend` or `TenantLead` `lastStatus`, it MUST invoke coin debit/refund handling for that outbound send according to `coin-debit-on-status` (tenant trigger, idempotent debit, failed refund). Status persistence MUST still succeed even if the send is not yet billable.

#### Scenario: Delivered on list send debits when due
- **WHEN** webhook `delivered` is persisted for a list `wamid` and the tenant trigger is `delivered` and the send is uncharged
- **THEN** coins are debited and `TenantListSend.coinDebitedAt` is set

#### Scenario: Failed on city send refunds and reopens
- **WHEN** webhook `failed` is persisted for a city `TenantLead` `wamid` that was previously debited
- **THEN** a credit is applied, `coinRefundedAt` is set, and city reopen rules for that lead are applied

#### Scenario: Sent status only updates delivery fields when trigger is delivered
- **WHEN** webhook `sent` is persisted and effective trigger is `delivered`
- **THEN** `lastStatus` updates and coin balance is unchanged

### Requirement: City outreach lastStatus follows webhook statuses
When a statuses event `wamid` matches a `TenantLead.messageId`, the system MUST update that `TenantLead.lastStatus` to the mapped delivery status (`sent`, `delivered`, `read`, `failed`). Unknown Meta status strings MUST be skipped without changing `lastStatus`. City `failed` MUST NOT clear a list-campaign send lock.

#### Scenario: Delivered updates city lastStatus
- **WHEN** webhook posts `status=delivered` for a city outreach `wamid`
- **THEN** that `TenantLead.lastStatus` MUST become `delivered`

#### Scenario: City failed does not unlock list leads
- **WHEN** a city outreach `wamid` receives `status=failed` and a list lead is locked by a campaign
- **THEN** that list lead lock MUST remain unchanged

