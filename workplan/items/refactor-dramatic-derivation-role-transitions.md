---
id: refactor-dramatic-derivation-role-transitions
title: Extract dramatic-derivation role transition coordinators
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-09
updated: 2026-08-10
branch: codex/refactor-dramatic-derivation-turn-transitions
verification: >-
  364/364 direct role/runDrama assertions, 8,285/8,285 hermetic root tests,
  137/137 tutor-core tests, and all eight risk groups pass. Role owners reach
  89.99% line/67.49% branch/89.47% function coverage, every new function is
  complexity 26 or lower, and source, format, lint, manifest, and cycle gates
  pass.
claim_status: planned
depends_on:
  - refactor-dramatic-derivation-run-state
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md
  code:
    - services/dramaticDerivation/engine.js
    - services/dramaticDerivation/runState.js
    - services/dramaticDerivation/directorTransition.js
    - services/dramaticDerivation/tutorTransition.js
    - services/dramaticDerivation/learnerTransition.js
    - tests/dramaticDerivationRoleTransitions.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/619
tags:
  - refactoring
  - dramatic-derivation
  - role-transitions
  - runtime
milestone: evaluation-infrastructure
---

Continue R5 as a stacked child of PR #619. The explicit state/result boundary
is established, but `runDrama()` still directly owns every role call and all
three response-application paths. Its 2,425-line facade and complexity-454 loop
make role protocol, formal state mutation, and post-turn lifecycle difficult to
change or test independently.

Acceptance:

- Introduce named director, tutor, and learner transition coordinators around
  the existing injected role functions and explicit run-state contract.
- Preserve role call order, cadence, role-scoped views, release authority,
  act/scene transitions, learner concealment, assertion precedence, transcript
  row ordering and metadata, ledgers, repairs, and instrumentation.
- Keep post-learner scene/stall/decay/monitor policy in the engine for a later
  lifecycle slice; do not move unrelated view construction in this child.
- Reduce `engine.js` below 2,000 lines and `runDrama()` complexity below 300;
  keep each new owner below 650 lines and every new function below complexity
  30, with no import cycle.
- Add direct transition boundary characterization and ratchet it in the
  hermetic manifest and risk-coverage configuration.
- Introduce no prompt, provider, option, schema, persistence, scoring, public
  browser, empirical-claim, or generated-workplan-view change.

Log:

- 2026-08-09 — Activated from PR #619 head `4d05590a` as an explicit stacked
  dependency while that PR is open and mergeable. Baseline is a 2,425-line
  engine with complexity-454 `runDrama()`; all 360 assertions in the 20 direct
  runDrama test files pass before editing.
- 2026-08-10 — Completed the role-transition extraction. Director cadence,
  release, acts, and transcript projection; tutor view instrumentation,
  releases, strategy/plot ledgers, reconstruction, and repairs; and learner
  formal actions, derivations, trajectory, ledgers, and assertion handling now
  have bounded owners. `engine.js` fell from 2,425 to 1,622 lines and
  `runDrama()` complexity from 454 to 123. The owners are 156, 484, and 519
  lines with maximum complexities 13, 26, and 13. All 364 direct assertions,
  8,285 hermetic root tests, 137 tutor-core tests, eight risk groups, and
  structural gates pass without provider calls or production-data writes.
- 2026-08-10 — Rebased cleanly onto post-PR-#619 main `049e2941`; the only
  intervening diff after the merged run-state commit was the serialized
  generated-board refresh, so the role-transition source patch restored
  without conflict.
