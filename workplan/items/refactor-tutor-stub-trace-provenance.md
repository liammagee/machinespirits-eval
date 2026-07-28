---
id: refactor-tutor-stub-trace-provenance
title: Refactor tutor-stub trace provenance
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 7 focused trace-schema assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve schema, config hash, Git summary, repository-root forwarding, independent failure capture, and non-blocking behavior
branch: codex/refactor-tutor-stub-trace-provenance
claim_status: planned
depends_on:
  - refactor-tutor-stub-trace-secret-redaction
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/traceSchema.js
    - scripts/tutor-stub.js
    - tests/traceSchema.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-trace-secret-redaction
tags:
  - refactoring
  - tutor-stub
  - traces
  - provenance
milestone: evaluation-infrastructure
---

Fifty-loop run 34: move failure-tolerant tutor-stub run provenance assembly
into the shared trace-schema service.

Acceptance:

- Schema, config hash, Git summary, repository-root forwarding, independent
  failure capture, and non-blocking behavior remain exact.
- Hashing, Git inspection, trace creation, persistence, runtime state, and
  effects remain injected or unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing provenance data, trace schemas, Git inspection, or persistence.

Log:

- 2026-07-28 — Moved failure-tolerant tutor-stub run provenance assembly into
  the shared trace-schema service, reducing `scripts/tutor-stub.js` by 11
  lines. Seven focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
