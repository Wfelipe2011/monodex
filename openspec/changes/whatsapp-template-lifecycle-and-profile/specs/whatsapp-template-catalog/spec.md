## MODIFIED Requirements

### Requirement: Super admin can sync and list the catalog
The system SHALL allow a `SUPER_ADMIN` to trigger a catalog sync and to list catalog rows including parsed `slots` and raw Meta `components` under `/platform/whatsapp-templates`. Listing MUST NOT require a code deploy when Meta templates change; a successful sync MUST be sufficient. Each list item MUST include at least `name`, `language`, `status`, `slots`, and `components`.

#### Scenario: Manual sync
- **WHEN** `SUPER_ADMIN` calls `POST /platform/whatsapp-templates/sync`
- **THEN** the system MUST fetch `/{wabaId}/message_templates` for the enabled **default** platform WhatsApp account and upsert catalog rows on that account

#### Scenario: List includes slots
- **WHEN** `SUPER_ADMIN` calls `GET /platform/whatsapp-templates`
- **THEN** each item MUST include `name`, `language`, `status`, and `slots` with stable keys such as `body.1` or `body.customer_name`

#### Scenario: List includes components for preview
- **WHEN** `SUPER_ADMIN` calls `GET /platform/whatsapp-templates` and a row stores BODY text with placeholders
- **THEN** each item MUST include `components` containing that BODY `text` for client-side preview
