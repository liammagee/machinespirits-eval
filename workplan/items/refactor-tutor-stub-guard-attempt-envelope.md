---
id: refactor-tutor-stub-guard-attempt-envelope
title: Refactor tutor-stub guard attempt envelope
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: focused 16/16; hermetic root 7435/7435 across 547 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-guard-attempt-envelope
claim_status: planned
depends_on:
  - refactor-tutor-stub-repair-spans
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/353
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubGuardAttemptProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubGuardAttemptProjection.test.js
    - tests/tutorStubGuardAccounting.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-repair-spans
tags:
  - refactoring
  - tutor-stub
  - guard
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 4: move deterministic guard-attempt envelope projection into a
dependency-light owner while retaining audit flattening at the CLI boundary.

Acceptance:

- Candidate, audit, generation, configuration, guarded-span, repair-span, and
  recovery metadata schemas remain exact.
- Usage and configuration records retain defensive JSON-clone behavior.
- The CLI strictly shrinks while audit evaluation, repair selection,
  accounting aggregation, runtime state, and effects stay in current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing guard results, retry policy, accounting totals, schema versions,
  candidate selection, or model behavior.

Log:

- 2026-07-28 — Activated from PR #352's reviewed head at `10de35ec`; the
  24,699-line CLI still owned deterministic guard-attempt projection.
- 2026-07-28 — Extracted the dependency-light projector, pinned its complete
  schema and defensive clones directly, and removed the now-dead guarded-span
  wrapper that lint exposed. The CLI shrank by 32 lines; 16 focused, 7,435
  root, and 137 tutor-core assertions pass with zero skips, together with every
  static and source-only gate.
