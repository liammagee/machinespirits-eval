---
id: refactor-tutor-stub-closeout-projection
title: Refactor tutor-stub closeout projection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Pure closeout labels, status, count formatting, and
  guard-accounting aggregation preserve the established report schema and
  values; focused, hermetic, static, and source-only gates pass without model
  calls.
branch: codex/refactor-tutor-stub-closeout-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-field-presentation
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubCloseoutProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubCloseoutProjection.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-field-presentation
tags:
  - refactoring
  - tutor-stub
  - closeout
  - guard-accounting
milestone: evaluation-infrastructure
---

Bounded R3 slice: move pure tutor-stub closeout labels, status projection,
count formatting, and guard-accounting summary aggregation out of the
interactive CLI without moving report assembly or application behavior.

Out of scope:

- Changing closeout wording, precedence, report schema, metric names, rates,
  guard categories, dynamic guard namespaces, or trace ordering.
- Consolidating or redesigning the deliberately distinct auto-eval guard
  summary in `scripts/run-tutor-stub-auto-eval.js`.
- Moving `printDialogueCloseout`, terminal output, filesystem access, trace
  persistence, field computation, commands, model calls, or mutable state.
- Running model-backed or paid evaluations.

Acceptance:

- One pure service owns closeout reason/status projection, frequency-count
  formatting, and interactive guard-accounting aggregation.
- The CLI imports those helpers behind the same call sites while retaining
  report assembly, printing, paths, traces, commands, and state changes.
- Frozen fixtures pin every authored reason, completion precedence,
  singular/plural grammar, empty summaries, exact aggregate metrics,
  `byPolicyProfile`, dynamic guard namespaces, and input immutability.
- Focused and full hermetic tests, manifest, lint, formatting, cycles,
  source-only workplan, syntax, and diff gates pass without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `b91e496b` after PR
  #243 merged with every CI lane green. Selected this pure closeout projection
  seam because terminal/report assembly and all runtime behavior remain behind
  their existing boundaries.
- 2026-07-26 — Moved five pure helpers into a 151-line leaf service and reduced
  the CLI from 27,223 to 27,089 lines. Exact projection plus the adjacent
  field, learning-summary, response-detail, and spawned guard-accounting suites
  pass 32/32 after correcting one import alias found by the integration gate.
- 2026-07-26 — Review parity is green: the complete hermetic root and
  tutor-core run exited cleanly with zero skips (core 137/137). Repository-wide
  ESLint and formatting, manifest, zero-cycle (366 files), 195-item source-only
  workplan, syntax, and diff checks pass without model calls.
- 2026-07-26 — PR #247 merged as `57cba50c` with every CI lane green; the
  serialized workplan render followed as `7a22b818`. Closed this child and
  handed the next pure R3 seam to `refactor-tutor-stub-interim-presentation`.
