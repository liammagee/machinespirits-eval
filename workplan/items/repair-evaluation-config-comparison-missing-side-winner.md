---
id: repair-evaluation-config-comparison-missing-side-winner
title: Define missing-side winner semantics in configuration comparison
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: review
created: 2026-08-06
updated: 2026-08-06
verification: >-
  Configuration-comparison tests prove the reviewed policy for scenarios
  missing from either side, including score, difference, winner, and overall
  win/tie counts, without changing complete-pair behavior.
claim_status: planned
links:
  code:
    - services/evaluationStore/statisticsRepository.js
    - tests/evaluationStoreStatisticsRepository.test.js
  items:
    - refactor-evaluation-store-statistics-repository
tags:
  - evaluation
  - statistics
  - correctness
  - compatibility
milestone: evaluation-infrastructure
---

`compareConfigs()` currently reports `winner: tie` when a scenario exists only
for configuration 2, even though it reports a negative difference using zero
for the absent configuration. The relational winner check receives
`undefined`, while score and difference projections use fallback values.

Before repair, choose and document whether an absent side means zero, missing,
or excluded from win counts; then update both left-missing and right-missing
cases symmetrically. The statistics-repository refactor preserves the current
output to avoid bundling a behavior change into an ownership-only PR.
