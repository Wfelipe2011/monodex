## ADDED Requirements

### Requirement: City refill prefers premium when replacing a premium failure
When selecting a single city replacement lead for an open send run after a failure whose failed (or attempted) lead was premium under `premium-lead-mix` classification rules, the system MUST prefer an unused premium candidate that is eligible for the run. If no premium candidate remains, the system MUST fall back to an eligible non-premium candidate. When the failed lead was not premium, selection MUST use the normal single-slot mix rules (equivalent to stratified pick with `X = 1`).

#### Scenario: Premium failure replaced by premium
- **WHEN** a city run refill is triggered after failure of a premium lead and at least one unused premium candidate remains
- **THEN** the refill lead MUST be premium

#### Scenario: Premium failure falls back when pool empty
- **WHEN** a city run refill is triggered after failure of a premium lead and no unused premium candidates remain but non-premium candidates exist
- **THEN** the refill lead MUST be a non-premium eligible lead

#### Scenario: Non-premium failure uses normal single pick
- **WHEN** a city run refill is triggered after failure of a non-premium lead
- **THEN** the refill lead MUST be chosen with the standard mix rules for `X = 1`
