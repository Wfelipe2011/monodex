## ADDED Requirements

### Requirement: Super admin can create marketing templates on the platform WABA
The system SHALL allow a `SUPER_ADMIN` to create a WhatsApp message template with category `MARKETING` via `POST /platform/whatsapp-templates`, submitting name, language, parameter format, and `components` (HEADER TEXT or IMAGE, BODY with optional variables, optional FOOTER, optional BUTTONS including URL and/or QUICK_REPLY). The system MUST call Meta Graph on the enabled default platform account WABA, persist/upsert a local `WhatsappMessageTemplate` row with returned `metaId` and status, and derive `slots` from components. Non-`SUPER_ADMIN` callers MUST receive HTTP 403. Categories other than `MARKETING` MUST be rejected with HTTP 400 in this capability.

#### Scenario: Create marketing template with body variables
- **WHEN** `SUPER_ADMIN` posts a valid MARKETING template with BODY text containing `{{1}}` and required examples
- **THEN** Graph MUST be called to create the template and a catalog row MUST exist with matching name/language and parsed `slots` including `body.1`

#### Scenario: Create with IMAGE header requires media handle
- **WHEN** `SUPER_ADMIN` posts HEADER format IMAGE without a valid header media handle/example
- **THEN** the API MUST respond HTTP 400 and MUST NOT create a catalog row

#### Scenario: Non super-admin cannot create
- **WHEN** a user without `SUPER_ADMIN` posts to create a template
- **THEN** the API MUST respond HTTP 403

### Requirement: Super admin can edit eligible catalog templates
The system SHALL allow a `SUPER_ADMIN` to `PATCH /platform/whatsapp-templates/:id` updating components (full replace as required by Meta) for a catalog row that has a `metaId`, calling Graph edit and upserting local `components`, `slots`, and `status`. The system MUST propagate Graph policy/rate/edit-limit errors as HTTP 400 with a clear message and MUST NOT leave the local row inconsistent when Graph rejects the edit (no silent success).

#### Scenario: Edit updates local components
- **WHEN** `SUPER_ADMIN` patches an existing template id with a new BODY text and Graph accepts the edit
- **THEN** the catalog row MUST store the new `components` and recomputed `slots`

#### Scenario: Edit without metaId rejected
- **WHEN** the catalog row has null `metaId`
- **THEN** the API MUST respond HTTP 400 and MUST NOT call Graph edit

### Requirement: Super admin can delete templates with local safety checks
The system SHALL allow a `SUPER_ADMIN` to `DELETE /platform/whatsapp-templates/:id`. Before removing the local row, the system MUST reject with HTTP 409 when any tenant grant, outreach config FK, list campaign FK, or on-demand send/schedule FK still references that template id. When no local references exist, the system MUST delete (or request delete of) the template on Graph and remove the catalog row.

#### Scenario: Delete blocked by grant
- **WHEN** template 10 is granted to any tenant and `SUPER_ADMIN` deletes id 10
- **THEN** the API MUST respond HTTP 409 and the catalog row MUST remain

#### Scenario: Delete succeeds without references
- **WHEN** template 10 has no local FK references and Graph delete succeeds
- **THEN** the catalog row MUST be removed

### Requirement: Super admin can upload media handles for Meta template assets
The system SHALL allow a `SUPER_ADMIN` to upload binary media used as Meta example/header handles for template create/edit (and reusable for profile picture handles when applicable) via a platform endpoint under `/platform/whatsapp-templates` or `/platform/whatsapp-media`, returning an opaque `handle` string suitable for Graph `header_handle` / `profile_picture_handle`. The access token MUST come from the default platform account env key and MUST NOT be returned.

#### Scenario: Upload returns handle
- **WHEN** `SUPER_ADMIN` uploads a valid image for template header example
- **THEN** the response MUST include a non-empty `handle` and MUST NOT include the Meta access token
