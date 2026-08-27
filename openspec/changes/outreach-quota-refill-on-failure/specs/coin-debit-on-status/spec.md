## ADDED Requirements

### Requirement: Run charged accounting follows debit and refund
When `coinDebitOnStatus` successfully debits a city `TenantLead` or list `TenantListSend` that has a non-null send-run id, the system MUST notify run accounting so that run's `chargedCount` increments per `outreach-send-run`. When a previously debited run-linked send is refunded due to `failed`, the system MUST notify run accounting so that send no longer counts toward the run's charged target (decrement or equivalent). On-demand debits/refunds MUST NOT affect send runs.

#### Scenario: Debit bumps run charged
- **WHEN** a billable status debits a run-linked city or list send
- **THEN** that run's `chargedCount` MUST increase by 1 (and may close the run when target is met)

#### Scenario: Failed refund removes charge credit
- **WHEN** a run-linked send is refunded after `failed`
- **THEN** that run's charged progress toward `targetCount` MUST not retain that send as a lasting charge

#### Scenario: First failed triggers refill hook after billing
- **WHEN** status `failed` is applied for a run-linked city or list send
- **THEN** after refund/reopen handling, the system MUST invoke at-most-once quota refill for that send per `outreach-send-run`
