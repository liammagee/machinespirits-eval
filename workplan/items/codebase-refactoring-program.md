---
id: codebase-refactoring-program
title: Execute the evidence-led codebase refactoring programme
status: triaged
type: maintenance
priority: P1
owner: unassigned
source: review
created: 2026-07-24
updated: 2026-07-24
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
