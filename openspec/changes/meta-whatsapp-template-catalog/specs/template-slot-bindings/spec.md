## ADDED Requirements

### Requirement: Outreach config binds catalog templates and slots
The system SHALL persist, per tenant outreach config, an outreach catalog template id, a notify-tenant catalog template id, and a `slotBindings` JSON map keyed by role (`outreach` | `notify`) then slot key. Each binding MUST use a closed `type` set: `literal`, `header_image`, `lead.name`, `lead.phone`, `lead.city`, `lead.category`, `lead.rating`, `tenant.phone`, `now.date`, `now.datetime`. Types `literal` and `header_image` MUST include a `value`. The system MUST NOT persist Meta template names as the source of send identity.

#### Scenario: Bindings stored
- **WHEN** a config is written with `outreachTemplateId`, `notifyTemplateId`, and `slotBindings` covering all required slots of both templates
- **THEN** subsequent reads MUST return those ids and the binding map

#### Scenario: Unknown binding type rejected
- **WHEN** a client writes a binding whose `type` is not in the closed set
- **THEN** the write MUST be rejected

### Requirement: Binding resolution uses a small formatter
When resolving a send, `now.date` and `now.datetime` MUST use timezone `America/Sao_Paulo` and `pt-BR` formats `dd/MM/yyyy` and `dd/MM/yyyy HH:mm` respectively. `lead.rating` MUST use `pt-BR` decimal (comma). `lead.phone` MUST be digits with a `55` prefix when missing. `lead.city` MUST be the related city name. `lead.category` MUST be `Lead.category`. When a `lead.*` source is null or empty, the resolved text MUST be `—`.

#### Scenario: Missing rating becomes dash
- **WHEN** a binding of type `lead.rating` is resolved for a lead whose `rating` is null
- **THEN** the parameter text MUST be `—` and the send MUST still be attempted if other slots resolve

#### Scenario: Date in BRL
- **WHEN** a binding of type `now.date` is resolved
- **THEN** the parameter text MUST match the calendar date in `America/Sao_Paulo` formatted as `dd/MM/yyyy`
