---
id: refactor-tutor-stub-trace-display-path
title: Refactor tutor-stub trace display path
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 8 focused trace-schema assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve disabled-trace null handling, repository-root forwarding, file-path forwarding, and relative display output
branch: codex/refactor-tutor-stub-trace-display-path
claim_status: planned
depends_on:
  - refactor-tutor-stub-trace-provenance
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/traceSchema.js
    - scripts/tutor-stub.js
    - tests/traceSchema.test.js
  prs:
    - 409
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-trace-provenance
tags:
  - refactoring
  - tutor-stub
  - traces
  - presentation
milestone: evaluation-infrastructure
---

Fifty-loop run 35: move trace display-path projection into the shared trace
schema service while injecting filesystem-relative path resolution.

Acceptance:

- Disabled-trace null handling, repository-root forwarding, file-path
  forwarding, and relative display output remain exact.
- Filesystem resolution, trace persistence, runtime state, and effects remain
  injected or unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing trace locations, persistence, or displayed path semantics.

Log:

- 2026-07-28 — Moved trace display-path projection into the shared trace-schema
  service. The explicit multi-symbol import adds three CLI lines, while path
  semantics now have one owner. Eight focused assertions, complete zero-skip
  hermetic parity, and all static/source-only gates pass.
- 2026-07-28 — Opened PR #409 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
