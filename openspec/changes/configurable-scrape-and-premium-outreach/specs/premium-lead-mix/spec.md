## ADDED Requirements

### Requirement: Premium classification uses rounded rating and category-wide review average
The system SHALL classify a candidate lead as premium using platform-wide rules, not per-tenant thresholds. Website MUST NOT be used. Reviews equal to `0` or `null` MUST be treated as `1` both on the lead under test and when computing averages. The average for a category SHALL be the mean of those coalesced review counts over all non-deleted leads whose `categories` list contains that category, across all cities. A lead with raw `rating` less than `4` MUST NOT be premium. `Math.round(rating)` of `4` is premium when coalesced reviews are at least 5% of that category average. `Math.round(rating)` of `5` is premium when coalesced reviews are at least 10% of that category average. When the lead matches several tenant categories, it is premium if any matching category passes its own average.

#### Scenario: 4.7 is treated as five stars
- **WHEN** a non-deleted lead has `rating` 4.7 and coalesced reviews meeting the 10% bar of its category average
- **THEN** the lead MUST be classified as premium

#### Scenario: Rating below 4 is never premium
- **WHEN** a lead has `rating` 3.9 regardless of reviews
- **THEN** the lead MUST NOT be classified as premium

#### Scenario: Four-star uses the 5 percent bar
- **WHEN** a lead has `rating` 4.4 (`Math.round` = 4) and coalesced reviews >= 5% and < 10% of the category average
- **THEN** the lead MUST be classified as premium

#### Scenario: Null reviews count as one
- **WHEN** a lead has `reviews` null and another has `reviews` 0
- **THEN** both MUST use `1` in the premium comparison and in the category average

#### Scenario: Average includes all cities
- **WHEN** category C has leads in city A and city B
- **THEN** the average used for classifying a lead in category C MUST include coalesced reviews from both cities

### Requirement: Batch mix mirrors unused premium stock
For each tenant run, let `X` be the send cap (configured `leadsPerRun`, limited by remaining unique unused phones and by `floor(balance / costPerLead)`). Let `P` be unused premium candidates and `R` the unused non-premium candidates after all selection filters. The system SHALL pick `Y` premium leads and `X-Y` non-premium leads where `Y = 0` if `P = 0`, otherwise `Y = min(P, round(X * P / (P+R)))`, and if `R > 0` then `Y = min(Y, X-1)`. Sampling MUST be random within each pool. The combined batch MUST be shuffled so premium leads are not clustered at the front. The system MUST NOT send a batch composed only of premium leads when non-premium candidates still exist.

#### Scenario: Ten percent premium stock in a batch of ten
- **WHEN** `X` is 10, `P` is 10, and `R` is 90
- **THEN** the batch MUST contain 1 premium lead and 9 non-premium leads

#### Scenario: No premium left
- **WHEN** `P` is 0 and `R` >= `X`
- **THEN** the batch MUST contain `X` non-premium leads

#### Scenario: Premium cannot consume the whole batch
- **WHEN** `P` is 50, `R` is 5, and `X` is 10
- **THEN** `Y` MUST be at most 9

#### Scenario: Fewer candidates than X
- **WHEN** unused unique phones are fewer than `leadsPerRun`
- **THEN** the system MUST send at most the available unique phones
