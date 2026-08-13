## ADDED Requirements

### Requirement: Lead identity is phone plus city
The system SHALL identify a lead by the pair `(phone, cityId)`. The same phone number MAY exist as distinct leads in different cities. The system MUST NOT enforce uniqueness of `phone` alone.

#### Scenario: Same phone in two cities
- **WHEN** a scrape upserts phone `P` for city A and later upserts the same phone `P` for city B
- **THEN** two `Lead` rows MUST exist, one with `cityId` of A and one with `cityId` of B

#### Scenario: Same phone same city is one lead
- **WHEN** a scrape upserts phone `P` for city A and a lead with `(P, A)` already exists and is not soft-deleted
- **THEN** the system MUST update that existing row and MUST NOT create a second lead for `(P, A)`

### Requirement: Categories accumulate on the lead
The system SHALL store every Maps category observed for a `(phone, cityId)` on that lead. `category` SHALL remain the primary/last-seen category. `categories` SHALL be the set union of observed category strings.

#### Scenario: Second category in the same city
- **WHEN** an existing active lead in city A with category `Construtoras` is scraped again in city A under category `Consultorias`
- **THEN** `category` MUST become `Consultorias` and `categories` MUST contain both `Construtoras` and `Consultorias`

#### Scenario: Backfilled lead has categories from category
- **WHEN** existing leads are migrated
- **THEN** each lead MUST have `categories` containing at least its `category` value

### Requirement: Scrape upserts active leads and skips soft-deleted
On scrape persist, the system SHALL create a lead when `(phone, cityId)` does not exist. When it exists and `deletedAt` is null, the system SHALL update `name`, `website`, `rating`, `reviews`, `category`, and `categories`. When `deletedAt` is set, the system MUST NOT modify that row and MUST NOT create a duplicate.

#### Scenario: Re-scrape refreshes rating
- **WHEN** an active lead `(P, A)` is scraped again with a new rating and review count
- **THEN** those fields MUST be updated on the existing lead

#### Scenario: Soft-deleted lead is not resurrected
- **WHEN** a lead `(P, A)` has `deletedAt` set and a scrape finds the same phone in city A
- **THEN** the system MUST leave that row unchanged and MUST NOT insert another lead for `(P, A)`

#### Scenario: Missing phone is skipped
- **WHEN** a scrape result has no usable phone
- **THEN** the system MUST NOT persist a lead for that result
