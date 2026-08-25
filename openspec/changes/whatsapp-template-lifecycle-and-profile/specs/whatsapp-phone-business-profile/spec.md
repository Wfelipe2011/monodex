## ADDED Requirements

### Requirement: Super admin can read business profile of a platform WhatsApp account
The system SHALL allow a `SUPER_ADMIN` to `GET /platform/whatsapp-accounts/:id/business-profile` for a platform account (`tenantId` null). The system MUST call Meta Graph `/{phone-number-id}/whatsapp_business_profile` using that account's `phoneNumberId` and `tokenEnvKey`, and MUST return profile fields available from Graph (at least about, address, description, email, websites, vertical, and profile picture URL when present). The response MUST NOT include the access token. Unknown or non-platform account ids MUST yield HTTP 404.

#### Scenario: Read profile for dedicated platform number
- **WHEN** `SUPER_ADMIN` GETs business-profile for platform account id 3 with a configured token
- **THEN** the API MUST return Graph profile fields for that account's `phoneNumberId`

#### Scenario: Missing account
- **WHEN** `SUPER_ADMIN` GETs business-profile for an unknown id
- **THEN** the API MUST respond HTTP 404

### Requirement: Super admin can update business profile of a platform WhatsApp account
The system SHALL allow a `SUPER_ADMIN` to `PATCH /platform/whatsapp-accounts/:id/business-profile` accepting a subset of Meta business profile fields (`about`, `address`, `description`, `email`, `websites`, `vertical`, `profile_picture_handle`) and MUST POST them to Graph with `messaging_product=whatsapp`. Successful updates MUST return the refreshed profile (or confirmation plus subsequent GET semantics documented). Invalid Graph responses MUST surface as HTTP 400. Non-`SUPER_ADMIN` MUST receive HTTP 403. The system MUST NOT register or create phone numbers as part of this capability.

#### Scenario: Update about text
- **WHEN** `SUPER_ADMIN` patches `{ "about": "Atendimento 9h–18h" }` for an existing platform account
- **THEN** the system MUST POST the update to Graph for that `phoneNumberId` and MUST NOT persist the Meta token

#### Scenario: Update profile picture via handle
- **WHEN** `SUPER_ADMIN` patches `{ "profile_picture_handle": "<handle>" }` obtained from platform media upload
- **THEN** Graph MUST receive that handle on the business profile update

#### Scenario: Admin role forbidden
- **WHEN** a tenant `ADMIN` calls business-profile GET or PATCH
- **THEN** the API MUST respond HTTP 403
