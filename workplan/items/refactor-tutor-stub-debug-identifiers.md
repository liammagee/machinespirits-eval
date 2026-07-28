---
id: refactor-tutor-stub-debug-identifiers
title: Refactor tutor-stub debug identifiers
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 5/5 plus full hermetic root and tutor-core zero-skip contracts preserve exact timestamp, turn-id, and opening-id bytes; every static and source-only gate passes
branch: codex/refactor-tutor-stub-debug-identifiers
claim_status: planned
depends_on:
  - refactor-tutor-stub-second-loop-recovery
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDebugIdentity.js
    - scripts/tutor-stub.js
    - tests/tutorStubDebugIdentity.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-second-loop-recovery
tags:
  - refactoring
  - tutor-stub
  - trace
milestone: evaluation-infrastructure
---

Third-loop run 1: move deterministic trace/debug identifier formatting into a
dependency-free model while retaining trace writes and terminal effects in the
CLI.

Acceptance:

- Timestamp, valid/invalid turn, whitespace, fallback, padding, and opening
  contracts remain byte-exact.
- Trace creation, trace append, state selection, clipboard, and terminal
  presentation remain CLI-owned.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing trace schemas, filenames, ids, labels, display, or persistence.

Log:

- 2026-07-28 — Moved the dependency-free identifier model out of the CLI,
  reducing it by 10 lines. Five focused assertions and the complete hermetic
  root and tutor-core contracts pass with zero skips.
