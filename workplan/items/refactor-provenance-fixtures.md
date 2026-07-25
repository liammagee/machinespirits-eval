---
id: refactor-provenance-fixtures
title: Fixture the provenance validator integrity boundary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  Synthetic SQLite and dialogue-log fixtures exercise the production
  provenance CLI without private data; canonical and explicit log-root paths
  pass, while content-hash, turn-id, required-field, rubric-schema, and missing
  database or log cases return exact non-zero exits.
branch: codex/refactor-provenance-fixtures
depends_on:
  - refactor-paper-manifest-fixtures
  - normalize-provenance-validator-data-paths
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/validate-provenance.js
    - services/evaluationDataPaths.js
    - services/provableDiscourse.js
  items:
    - codebase-refactoring-program
    - normalize-provenance-validator-data-paths
tags:
  - refactoring
  - testing
  - provenance
  - hermetic
milestone: evaluation-infrastructure
---

Bounded row 15 slice: add production-CLI fixture coverage for the provenance
chain after the canonical data-root normalization, without using the private
evaluation database or transcript archive.

Out of scope:

- Editing historical run data, dialogue logs, score audits, or provenance
  waivers.
- Changing the content-turn ID or dialogue-hash algorithms.
- Refactoring the message-chain auditor or evaluation-store persistence layer.
- Running model-backed, paid, or private-data-dependent evaluation work.

Acceptance:

- A minimal tracked test builds its own SQLite schema and dialogue-log tree,
  invokes the production CLI, and proves a complete chain exits zero.
- Both a logs root and an explicit `tutor-dialogues` directory resolve to the
  same fixture without repo-local symlinks.
- Dialogue-content hash drift, turn-ID mismatch, missing provenance fields,
  rubric-version mismatch, missing logs, and a missing database exit non-zero
  with the expected structured failure reason or CLI diagnostic.
- Default complete-run selection and explicit single-run validation are both
  covered without private data.
- Focused tests, the root manifest, full hermetic parity, lint, formatting,
  cycle, source-only workplan, and diff gates pass without model calls.

## Log

- 2026-07-25 — Activated from `origin/main` at `47f0e6ea` after PR #227 merged
  the paper-manifest fixture extraction with every required CI check green.
  The 686-line provenance CLI already accepts explicit DB/log paths but has no
  direct fixture-to-exit test; current coverage exercises storage primitives
  and turn-ID helpers separately.
- 2026-07-25 — Added a test-only production-CLI harness that creates and removes
  its own minimal SQLite database, score audit, logs root, and
  `tutor-dialogues` tree. No production validator behavior or private artifact
  changed.
- 2026-07-25 — Six focused cases pass for explicit and selected-run success,
  normalized root/direct log paths, content-hash drift, persisted turn-ID
  mismatch, missing judge/config provenance, rubric-version mismatch, missing
  logs, and missing databases. Final rebased gates pass: 6,736/6,736 root tests and
  137/137 core tests with zero skips, plus lint, formatting, zero cycles,
  manifest, source-only workplan, and diff checks.
