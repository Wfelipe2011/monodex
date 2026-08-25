## ADDED Requirements

### Requirement: Existing phone numbers expose editable business profile
For each persisted platform Cloud API account identified by `phoneNumberId`, the system SHALL allow authorized operators to read and update the Meta WhatsApp business profile of that number without provisioning a new phone number. Display-name approval and phone registration flows remain out of scope for this requirement.

#### Scenario: Profile uses account phoneNumberId
- **WHEN** a platform account's business profile is fetched or updated
- **THEN** Graph calls MUST target that account's stored `phoneNumberId` and token env key
