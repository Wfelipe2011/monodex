# tenant-media-library Specification

## Purpose

Tenants upload and list images stored on gym-ctrl disk, expose them via unauthenticated public HTTPS URLs for Graph header links, and delete orphan files on a configurable job.

## Requirements

### Requirement: Tenant can upload and list media
The system SHALL persist tenant-owned image uploads with a filesystem path and a public UUID. `POST /tenant/:tenantId/media` (multipart) MUST accept tenant `ADMIN` JWT or API key and MUST reject Super Admin JWT with HTTP 403. Allowed MIME types MUST be `image/jpeg`, `image/png`, and `image/webp`. Files larger than 5 MB MUST be rejected. `GET /tenant/:tenantId/media` MUST list that tenant's rows (id, publicId, originalFileName, mimeType, byteSize, createdAt) without exposing the internal filesystem path. Super Admin MAY GET the list.

#### Scenario: Admin upload stored
- **WHEN** tenant 4 `ADMIN` uploads a PNG under 5 MB
- **THEN** a `TenantMedia` row exists for tenant 4, the file is on disk, and the 201 body includes `publicId` and not `relativePath`

#### Scenario: API key can upload
- **WHEN** a valid API key for tenant 4 POSTs the same multipart to the media path
- **THEN** the media is stored for tenant 4

#### Scenario: Super Admin upload forbidden
- **WHEN** `SUPER_ADMIN` POSTs media for tenant 4
- **THEN** the API responds with HTTP 403 and MUST NOT write a file

#### Scenario: List is tenant-scoped
- **WHEN** tenant 4 `ADMIN` GETs media
- **THEN** the response MUST NOT include media rows of tenant 5

#### Scenario: Oversized file rejected
- **WHEN** the upload exceeds 5 MB
- **THEN** the API responds with HTTP 400 and MUST NOT persist a row

### Requirement: Public media GET is unauthenticated
The system SHALL expose `GET /public/media/:publicId` without JWT or API key. A known `publicId` MUST return the file bytes with the stored `Content-Type`. Unknown ids MUST return HTTP 404. Sequential numeric `id` MUST NOT be required to fetch the file.

#### Scenario: Public fetch by UUID
- **WHEN** an unauthenticated client GETs `/public/media/{publicId}` for an existing row
- **THEN** the response is HTTP 200 with the image bytes and the stored MIME type

#### Scenario: Unknown public id
- **WHEN** the `publicId` does not exist
- **THEN** the API responds with HTTP 404

### Requirement: Header image URL is the public media URL
When an on-demand send uses `imageId`, the Graph `image.link` MUST be `{PUBLIC_API_BASE_URL}/public/media/{publicId}` using HTTPS in production. If `PUBLIC_API_BASE_URL` is missing, a send that needs that URL MUST be rejected with HTTP 400 without calling Graph.

#### Scenario: Absolute public URL used
- **WHEN** `PUBLIC_API_BASE_URL` is `https://api.example.com` and media publicId is `aaa-bbb`
- **THEN** Graph header image link MUST be `https://api.example.com/public/media/aaa-bbb`

#### Scenario: Missing base URL rejected
- **WHEN** `PUBLIC_API_BASE_URL` is unset and the template requires header image via `imageId`
- **THEN** the send MUST fail with HTTP 400 and MUST NOT call Graph

### Requirement: Configurable job deletes orphan files
The system SHALL persist `PlatformJobKey` `ORPHAN_MEDIA_CLEANUP` with default cron `0 3 1,16 * *` and timezone `America/Sao_Paulo`, editable by Super Admin via existing platform job schedule APIs. When the job runs on gym-ctrl, it MUST delete files under the media directory whose relative path is not referenced by any `TenantMedia` row. It MUST NOT delete files that still have a row. Disabled schedule MUST NOT run.

#### Scenario: Orphan file removed
- **WHEN** a file exists on disk with no matching `TenantMedia.relativePath` and the cleanup job runs
- **THEN** that file MUST be deleted and database rows MUST remain unchanged

#### Scenario: Referenced file kept
- **WHEN** a file's path matches a `TenantMedia` row and cleanup runs
- **THEN** the file MUST remain

#### Scenario: Disabled cleanup does not run
- **WHEN** `ORPHAN_MEDIA_CLEANUP` is stored with `enabled` false
- **THEN** gym-ctrl MUST NOT delete orphan files on a timer
