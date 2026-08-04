---
id: refactor-tutor-stub-trace-secret-redaction
title: Refactor tutor-stub trace secret redaction
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: 5 focused trace-schema assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve normalized secret keys, API-key strings, arrays, cycles, repeated references, primitives, and input immutability
branch: codex/refactor-tutor-stub-trace-secret-redaction
claim_status: planned
depends_on:
  - refactor-tutor-stub-console-stream-replay
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/traceSchema.js
    - scripts/tutor-stub.js
    - tests/traceSchema.test.js
  prs:
    - 407
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-console-stream-replay
tags:
  - refactoring
  - tutor-stub
  - traces
  - secrets
milestone: evaluation-infrastructure
---

Fifty-loop run 33: move recursive trace-secret redaction into the shared trace
schema service.

Acceptance:

- Normalized secret keys, API-key-shaped strings, arrays, cycles, repeated
  references, primitives, and input immutability remain exact.
- Trace creation, persistence, runtime state, and effects remain unchanged.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing trace schemas, trace contents, persistence, or secret policy.

Log:

- 2026-07-28 — Moved recursive trace-secret redaction into the shared trace
  schema service, reducing `scripts/tutor-stub.js` by 28 lines. Five focused
  assertions, complete zero-skip hermetic parity, and all static/source-only
  gates pass.
- 2026-07-28 — Opened PR #407 against `main`. The benchmark hook reported the
  standing calibration warning: baseline already failed and all six saved
  responses remain identical (zero improved, zero regressed, zero model calls).
