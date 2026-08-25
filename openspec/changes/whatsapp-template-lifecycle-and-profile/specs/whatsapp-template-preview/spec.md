## ADDED Requirements

### Requirement: Template list and get expose full components for client-side preview
The system SHALL return, for each catalog template in preview-capable endpoints, at least: `id`, `metaId` (nullable), `name`, `language`, `status`, `category`, `parameterFormat`, parsed `slots`, and raw Meta `components` JSON (including HEADER/BODY/FOOTER/BUTTONS texts with placeholders such as `{{1}}` and nested `example` / `buttons` when present). The system MUST NOT require a Meta Graph call to serve this payload when the row already exists in the local catalog. The system MUST NOT server-render interpolated preview text; clients substitute placeholders using `slots` keys and user-provided values.

#### Scenario: Platform list includes body text
- **WHEN** `SUPER_ADMIN` calls `GET /platform/whatsapp-templates` and a catalog row has BODY `text` containing `{{1}}`
- **THEN** that item's `components` MUST include that BODY object with the same `text` string and MUST include `slots` covering the BODY placeholders

#### Scenario: Platform get by id
- **WHEN** `SUPER_ADMIN` calls `GET /platform/whatsapp-templates/:id` for an existing catalog id
- **THEN** the response MUST include the preview fields (`components`, `slots`, and metadata listed above)

#### Scenario: Platform get missing
- **WHEN** `SUPER_ADMIN` calls `GET /platform/whatsapp-templates/:id` for an unknown id
- **THEN** the API MUST respond HTTP 404

### Requirement: Preview payload is stable for frontends
The system SHALL keep `components` in the Meta Cloud API shape stored at sync/create time (array of objects with `type` and type-specific fields). Slot keys MUST remain stable (`body.1`, `body.customer_name`, `header.image`, `button.0.url`, etc.) as produced by the shared slot parser.

#### Scenario: Positional template slots align with placeholders
- **WHEN** a BODY text contains `{{1}}` and `{{2}}` with positional format
- **THEN** `slots` MUST include keys `body.1` and `body.2` so a client can replace those tokens in `components` text
