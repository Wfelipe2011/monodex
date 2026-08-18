## ADDED Requirements

### Requirement: Slot bindings writes are tenant-owned
The system SHALL allow tenant `ADMIN` to persist `slotBindings` on outreach config and list campaigns for their tenant. `SUPER_ADMIN` MUST NOT persist bindings except when creating a missing resource or within 30 minutes of that resource's `createdAt`. Binding type validation and resolution rules remain unchanged.

#### Scenario: Admin writes outreach bindings
- **WHEN** `ADMIN` patches valid `slotBindings.outreach` covering required slots
- **THEN** subsequent reads MUST return that map

#### Scenario: Super admin bindings after window rejected
- **WHEN** outreach config `createdAt` is older than 30 minutes and `SUPER_ADMIN` patches `slotBindings`
- **THEN** the API responds with HTTP 403
