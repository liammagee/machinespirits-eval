---
id: refactor-tutor-stub-state-debug-identity
title: Refactor tutor-stub state debug identity
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 7 focused debug-identity assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve explicit and trace run IDs, no-trace fallback, precedence, turn normalization, and padding
branch: codex/refactor-tutor-stub-state-debug-identity
claim_status: planned
depends_on:
  - refactor-tutor-stub-trace-display-path
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDebugIdentity.js
    - scripts/tutor-stub.js
    - tests/tutorStubDebugIdentity.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-trace-display-path
tags:
  - refactoring
  - tutor-stub
  - traces
  - debug-identity
milestone: evaluation-infrastructure
---

Fifty-loop run 36: move state-aware run and turn debug-ID derivation into the
existing debug-identity service.

Acceptance:

- Explicit run IDs, trace run IDs, no-trace fallback, precedence, turn
  normalization, and padding remain exact.
- Debug printing, clipboard operations, runtime state, and effects remain in
  the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing debug-ID formats, trace identities, printing, or clipboard behavior.

Log:

- 2026-07-28 — Moved state-aware run and turn debug-ID derivation into the
  debug-identity service, reducing `scripts/tutor-stub.js` by six lines. Seven
  focused assertions, complete zero-skip hermetic parity, and all
  static/source-only gates pass.
