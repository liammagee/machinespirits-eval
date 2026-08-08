---
id: repair-evaluation-config-comparison-missing-side-winner
title: Define missing-side winner semantics in configuration comparison
status: done
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-08
branch: codex/repair-evaluation-config-comparison-missing-side-winner
verification: >-
  Configuration-comparison tests prove the reviewed policy for scenarios
  missing from either side, including score, difference, winner, and overall
  win/tie counts, without changing complete-pair behavior.
claim_status: methods
links:
  code:
    - services/evaluationStore/statisticsRepository.js
    - tests/evaluationStoreStatisticsRepository.test.js
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/578
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

The reviewed policy is now explicit: absence means missing data, not a zero.
The absent score, pairwise difference, and winner are `null`; the row is
excluded from win and tie counts and included in the separate `incomplete`
count. A real score of zero remains zero. Complete pairs retain the existing
win/tie semantics.

## Log

- 2026-08-08 — Reached review with symmetric left- and right-missing tests,
  explicit incomplete-count accounting, preserved zero scores, and an
  unchanged complete-pair winner contract. The focused statistics-repository
  suite passes 6/6.
- 2026-08-08 — Closed after PR #578 merged. The full Node 20/22 matrix,
  risk-coverage, workplan, validation, lint, and loopback checks all passed.
