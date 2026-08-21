## ADDED Requirements

### Requirement: List campaign sends use the tenant resolved phone number
List campaign template sends and notify-tenant sends SHALL use Cloud API credentials resolved for the campaign's tenant (dedicated assignment or default). They MUST NOT send from an arbitrary platform `findFirst` account.

#### Scenario: Campaign send on dedicated number
- **WHEN** the list campaign cron sends a template for a tenant assigned to platform account A
- **THEN** the Graph request MUST use account A's `phoneNumberId`

## MODIFIED Requirements

### Requirement: Button actions drive notify or noop
When an inbound webhook message has `type=button` and `context.id` matches a list campaign outbound `wamid`, the system MUST look up the configured action for that button label. `NOTIFY` MUST send the campaign's notify template to the tenant's phone using notify bindings and `recipient.*` / `tenant.phone` / literals, via the tenant's resolved platform Cloud API account. `NOOP` MUST persist the message only. Inbound text messages without a mapped button MUST NOT trigger notify.

#### Scenario: Notify on mapped button
- **WHEN** lead taps QUICK_REPLY whose label is configured as `NOTIFY`
- **THEN** the notify template is sent to `Tenant.phone` via the tenant's resolved platform Cloud API account

#### Scenario: Noop button
- **WHEN** lead taps QUICK_REPLY configured as `NOOP`
- **THEN** no notify template is sent

#### Scenario: Free text does not notify
- **WHEN** lead sends a text reply without button type
- **THEN** the message is stored and notify MUST NOT run
