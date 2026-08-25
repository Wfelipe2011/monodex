## ADDED Requirements

### Requirement: Super admin manages WhatsApp business profile via platform accounts API
The system SHALL expose business-profile read and update for platform WhatsApp accounts under `/platform/whatsapp-accounts/:id/business-profile` as specified by the `whatsapp-phone-business-profile` capability. These routes MUST NOT accept or return Meta access tokens and MUST NOT create or register new phone numbers.

#### Scenario: Profile routes are super-admin only
- **WHEN** a non-`SUPER_ADMIN` calls `GET` or `PATCH` on `/platform/whatsapp-accounts/:id/business-profile`
- **THEN** the API MUST respond HTTP 403
