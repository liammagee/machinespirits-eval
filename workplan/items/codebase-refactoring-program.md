---
id: codebase-refactoring-program
title: Execute the evidence-led codebase refactoring programme
status: active
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-25
verification: >-
  Every accepted refactoring slice has a linked child card and parity gate;
  root plus in-housed tutor-core tests run from one clean-install contract;
  required suites cannot silently skip; import cycles fall from two to zero;
  hotspot, coverage, registry, duplication, and package metrics ratchet without
  trace, schema, route, CLI, or empirical-output drift; every deletion passes
  its consumer, database, paper, and artifact audit.
claim_status: planned
depends_on: []
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - refactor-required-run-manifest
    - refactor-v-series-fixtures
    - refactor-dialogue-log-fixtures
    - refactor-cast-layer-fixture
    - refactor-pty-ci-lane
    - refactor-rubric-parser-tests
    - refactor-tutor-core-cycle
    - refactor-tutor-response-cycle
    - refactor-adaptive-trace-projection
    - refactor-field-policy-helpers
    - refactor-forbidden-key-audit
    - make-inhoused-tests-and-coverage-first-class
    - make-pilot-state-writes-atomic
    - isolate-remaining-direct-model-subprocesses
    - harden-consolidated-labelling-integrity
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
    - test-canonical-posthoc-analysis-pipeline
    - decide-rich-learner-memory-service-retention
    - tutor-stub-register-policy-extraction
    - tutor-stub-capability-session-runtime
    - tutor-stub-headless-session-transport
    - tutor-stub-process-session-factory
    - tutor-stub-unified-session-surface
    - normalize-provenance-validator-data-paths
    - tutor-stub-first-draft-series
    - adaptive-eval-immutable-provenance
tags:
  - refactoring
  - testing
  - coverage
  - dead-code
  - maintainability
milestone: evaluation-infrastructure
---

The detailed evidence, protected boundaries, ranked hotspots, candidate
deletions, sequencing, and verification matrix live in the linked plan. This is
the parent coordination card; do not copy that plan into the board.

Acceptance:

- Build on merged PR #177; start with the required-run/skip-ledger,
  hermetic-fixture, cycle, duplication, and canonical-registry slices listed in
  the plan.
- Create one child card and branch per bounded implementation slice; link each
  child back here and record its before/after metrics.
- Execute existing integrity cards rather than creating duplicate pilot,
  provider, labelling, browser/Electron, post-hoc, coverage, or rich-memory work.
- Preserve compatibility facades and frozen empirical behavior until a child
  card proves every consumer and migration gate.
- Mark this parent done only when every planned slice is done, explicitly
  dropped, or superseded with recorded evidence.

Log:

- 2026-07-24 — Rebased and reconciled after PR #177 merged the in-housed
  tutor-core and risk-coverage foundation; removed that completed work from the
  first execution queue and retained the environment-dependent skip/fixture
  blind spots as the opening slice.
- 2026-07-24 — Comprehensive static, structural, packaging, test-surface, and
  selected-runtime coverage review completed at `2a5d8981`; programme captured
  without starting implementation or deleting any candidate.
- 2026-07-24 — Execution started: R0.1 merged through PR #182; R0.2 activated
  on `codex/refactor-v-series-fixtures` with the closed first-draft and immutable
  provenance cards as explicit dependencies.
- 2026-07-24 — R0.2 reached review with the machine-local V-series skip removed,
  four source/hash-bound compact fixtures tracked, and focused plus full
  hermetic parity green. The next queued slice remains R0.3 dialogue-log
  fixtures after this branch lands.
- 2026-07-24 — PR #188 merged and R0.2 closed. Activated R0.3 on
  `codex/refactor-dialogue-log-fixtures` to replace ambient dialogue-log
  discovery with tracked hermetic fixtures and discharge its skip-ledger entry.
- 2026-07-24 — R0.3 reached review with three tracked architecture fixtures,
  all dialogue-structure groups executing hermetically, the ambient-log skip
  removed, and focused plus full local validation green. The next queued slice
  remains R0.4 cast-layer fixture extraction after this branch lands.
- 2026-07-24 — PR #192 merged and R0.3 closed. Activated R0.4 on
  `codex/refactor-cast-layer-fixture` to replace the gitignored reader-quality
  matrix dependency with an explicitly synthetic tracked scorer fixture and
  discharge its skip-ledger entry.
- 2026-07-24 — R0.4 reached review with the cast-layer scorer executing against
  a tracked test-only matrix, its private-export skip removed, and the complete
  root manifest passing with zero skips. The next queued slice remains R0.5's
  permitted PTY/loopback CI lane after this branch lands.
- 2026-07-24 — PR #193 merged and R0.4 closed. Activated R0.5 on
  `codex/refactor-pty-ci-lane`: the existing CI-conditioned skip remains explicit
  in the parallel root manifest while a dedicated Linux lane opts the same
  concurrency assertion back in and requires natural teardown.
- 2026-07-24 — R0.5 reached review with a named Ubuntu PTY/loopback job, a
  natural-teardown package contract, and the previously skipped concurrent
  input assertion executing under CI opt-in. The next queued slice remains
  R0.6's production rubric-parser characterization after this branch lands.
- 2026-07-24 — PR #194 merged and R0.5 closed with the dedicated PTY/loopback
  check green. Activated R0.6 on `codex/refactor-rubric-parser-tests` to delete
  the test-local parser copy and run the malformed-response corpus against the
  production export under v2.1 and v2.2 rubric configuration.
- 2026-07-24 — R0.6 reached review with the copied parser and generated test
  module removed, both versioned tutor-rubric shapes characterized through the
  production parser, and focused plus full hermetic parity green. The next
  queued slice is R1.1 on `codex/refactor-tutor-core-cycle` after this branch
  lands.
- 2026-07-24 — PR #196 merged and R0.6 closed. Activated R1.1 on
  `codex/refactor-tutor-core-cycle` to move shared quiet-mode state into a
  dependency-free leaf and ratchet the static import-cycle baseline from two
  strongly connected components to one.
- 2026-07-24 — R1.1 reached review with the tutor-core cycle removed, the
  existing quiet-mode export surface preserved, and an exact CI cycle ratchet
  admitting only the queued tutor-stub response component. Full hermetic parity
  is green; the next queued slice is R1.2 on
  `codex/refactor-tutor-response-cycle` after this branch lands.
- 2026-07-24 — PR #198 merged and R1.1 closed. Activated R1.2 on
  `codex/refactor-tutor-response-cycle` to move the three remaining cross-module
  accessibility, role-visibility, and schema seams into leaf modules while
  preserving each existing facade and ratcheting static cycles from one to
  zero.
- 2026-07-24 — R1.2 reached review with static import cycles eliminated,
  compatibility bindings preserved, and focused plus full hermetic parity
  green. The next queued slice is R1.3 adaptive trace projection on
  `codex/refactor-adaptive-trace-projection` after this branch lands.
- 2026-07-24 — PR #200 merged and R1.2 closed. Activated R1.3 on
  `codex/refactor-adaptive-trace-projection` to move adaptive trace recognition,
  scenario/dialogue conversion, and learner-turn extraction into one pure
  projection service shared by the evaluation CLI and runner.
- 2026-07-24 — R1.3 adaptive trace projection reached review with one pure
  production definition, deep-equal frozen projection coverage, and focused
  plus full hermetic parity green. The next queued duplicate family is the
  field trajectory/register-policy helper slice on
  `codex/refactor-field-policy-helpers` after this branch lands.
- 2026-07-25 — PR #202 merged and closed the adaptive trace-projection child.
  Activated the bounded field trajectory/register-policy helper consolidation
  on `codex/refactor-field-policy-helpers`; the intentionally divergent
  acceleration-aware trajectory window remains out of scope.
- 2026-07-25 — The field-policy helper child reached review with a neutral DAG
  feature leaf, eight exact register-policy declarations removed, facade
  binding identity plus deep-equality coverage, and focused/full hermetic parity
  green. The next queued duplicate family is forbidden-key auditing on
  `codex/refactor-forbidden-key-audit` after this branch lands.
- 2026-07-25 — PR #208 merged and closed the field-policy helper child.
  Activated the next R1.3 duplicate family on
  `codex/refactor-forbidden-key-audit`; this branch touches only the seven
  dramatic-derivation auditors, their shared helper, and parity coverage.
- 2026-07-25 — The forbidden-key audit leaf reached review with seven recursive
  copies reduced to one pure helper, caller-specific policies pinned by a
  shared corpus, and focused plus full hermetic parity green. The next queued
  independent duplicate family remains lightweight field-turn projection.
