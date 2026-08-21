## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Failed status unlocks list lead for other campaigns
When a `failed` status is recorded for a list campaign outbound `wamid`, the system MUST clear the list lead send lock so other campaigns on the same list MAY target that lead again. Coin refund for that send MUST follow `coin-debit-on-status`.

#### Scenario: Unlock on failed
- **WHEN** failed status arrives for send S tied to list lead L
- **THEN** L MUST no longer be locked by S's campaign

#### Scenario: Unlock and refund together
- **WHEN** failed status arrives for a previously debited list send
- **THEN** the lead is unlocked and a credit is recorded once
