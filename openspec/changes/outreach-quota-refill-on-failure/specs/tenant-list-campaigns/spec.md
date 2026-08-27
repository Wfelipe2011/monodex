## MODIFIED Requirements

### Requirement: Batch size respects sendsPerRun and balance
Each cron tick for a campaign SHALL open an `outreach-send-run` list run whose `targetCount` is `sendsPerRun`, and SHALL attempt Graph sends toward that target, further capped by `floor(availableBalance / costPerSend)` and eligible unlocked leads. Sends MUST be spaced by `sendIntervalSeconds` between Cloud API requests for that campaign run, including refill POSTs. Graph failures during the tick and Meta `failed` on run-linked sends MUST trigger same-run single-lead refill per `outreach-send-run` (try cap `targetCount * 3`). The semantic goal of `sendsPerRun` is charged sends for the run.

#### Scenario: Balance caps batch
- **WHEN** available balance covers 2 sends and `sendsPerRun` is 5
- **THEN** at most 2 leads are Graph-attempted in the initial phase of that tick

#### Scenario: Pending reservation reduces batch
- **WHEN** raw balance covers 3 sends but 1 pending uncharged send exists on the list
- **THEN** at most 2 new sends are attempted in the initial phase of that tick

#### Scenario: Graph failure refills in same run
- **WHEN** `sendsPerRun` is 5 and one Graph POST fails during the campaign tick while the run remains eligible
- **THEN** the system MUST attempt exactly one replacement list lead for that run after `sendIntervalSeconds`
