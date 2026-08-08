---
id: refactor-operational-score-store-ownership
title: Give operational scoring scripts explicit evaluation-store ownership
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-08
updated: 2026-08-08
branch: codex/refactor-operational-score-store-ownership
verification: >-
  Lifecycle, usage-before-database, isolated empty-run CLI, boundary-inventory,
  focused scoring-helper, hermetic root and tutor-core, risk-coverage, source,
  lint, formatting, manifest, and cycle gates prove four scoring tools own and
  close their stores without changing score construction or persistence.
claim_status: planned
depends_on:
  - refactor-longitudinal-report-store-ownership
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore/scriptContext.js
    - scripts/evaluate-charisma.js
    - scripts/evaluate-register-rubric.js
    - scripts/evaluate-learner-standalone.js
    - scripts/score-d4-first-turns.js
  items:
    - codebase-refactoring-program
    - refactor-longitudinal-report-store-ownership
tags:
  - refactoring
  - evaluation
  - operational-scripts
  - scoring
  - dependency-injection
  - lifecycle
  - maintainability
milestone: evaluation-infrastructure
---

Continue the operational-script host migration after the longitudinal report
cohort. These four tools read evaluation rows and persist tutor or learner
scores, so each invocation should own one bounded store instead of reaching
through the lazy process-global compatibility facade.

Acceptance:

- Remove the legacy evaluation-store facade from all four scripts and acquire
  one explicitly owned store only after CLI usage has validated.
- Thread the selected store through every result read and score mutation while
  preserving each script's existing dialogue-log lookup behavior, prompts,
  rubrics, score normalization,
  filters, persistence payloads, output, or model-call admission.
- Export naturally completing `main()` entrypoints that return status codes;
  set `process.exitCode` only after owned stores have closed.
- Preserve injected host-owned stores for tests and composition; never close
  them inside the script boundary.
- Prove usage paths create no database, and exercise deterministic missing-run
  or check-only paths against an explicitly selected isolated database without
  making a model call.
- Ratchet direct facade consumers from 13 to 9 live/package and operational
  scripts from 12 to 8 without production writes or generated workplan views.

Log:

- 2026-08-08 — Activated from refreshed main `06dcb986` after PR #571 merged.
  Baseline: all four scoring scripts import the lazy facade and three can call
  `process.exit()` after store startup. The executable inventory contains 13
  live/package consumers, including 12 operational scripts.
- 2026-08-08 — Migrated all four scripts to the shared explicit script-store
  context. Usage paths remain database-free; isolated missing-run/check paths
  make no model calls; host-injected stores stay open; and executable inventory
  now records 9 live/package consumers, including 8 operational scripts.
  Focused scorer/stance tests pass 49/49, lifecycle/inventory tests pass 16/16,
  root shards pass 4,512/4,512 and 3,585/3,585, tutor-core passes 137/137,
  risk coverage passes all five groups, and lint, formatting, manifest,
  source-only workplan, static-cycle, diff, and boundary gates pass. Independent
  symmetry review found no payload, rubric, trace-label, or aggregation drift.
