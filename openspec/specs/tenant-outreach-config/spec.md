# tenant-outreach-config Specification

## Purpose

Persist and apply per-tenant outreach settings (enabled, pricing, templates, schedule, categories) for Cloud API outreach eligibility.

## Requirements

### Requirement: Outreach configuration exists per tenant
The system SHALL persist outreach settings per tenant, including at least: enabled flag, cost per lead, cashback on reply, outreach template name, notify-tenant template name, schedule, and eligible categories.

#### Scenario: Config created for tenant
- **WHEN** an outreach config is stored for a tenant
- **THEN** the system MUST associate exactly one config record with that tenant

#### Scenario: Disabled by default for new configs
- **WHEN** a new outreach config is created without an explicit enabled value
- **THEN** outreach MUST be treated as disabled until enabled is set true

### Requirement: Enabled outreach requires tenant phone
The system SHALL NOT treat a tenant as eligible for outreach when `Tenant.phone` is null or empty, even if the outreach config is enabled.

#### Scenario: Enabled without phone
- **WHEN** outreach config has enabled=true and the tenant has no phone
- **THEN** the tenant MUST be skipped by outreach selection and MUST NOT receive Cloud API sends attributed to that tenant's funnel

#### Scenario: Enabled with phone
- **WHEN** outreach config has enabled=true and the tenant has a non-empty phone
- **THEN** the tenant MUST be eligible for outreach selection subject to balance and schedule rules

### Requirement: Pricing and templates come from config
The system SHALL debit coins using the tenant's configured cost per lead and SHALL select Meta template names from the tenant's outreach config for outbound lead contact and tenant notification.

#### Scenario: Contact lead uses configured cost
- **WHEN** a lead is successfully contacted for a tenant via Cloud API
- **THEN** the system MUST decrement coin balance by that tenant's `costPerLead` and record a matching debit transaction

#### Scenario: Reply cashback uses configured amount
- **WHEN** a lead reply is processed as affirmative and cashback is applied
- **THEN** the system MUST credit coins by that tenant's `cashbackOnReply`
