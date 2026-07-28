---
id: refactor-tutor-stub-repair-spans
title: Refactor tutor-stub exact repair spans
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 14/14; hermetic root 7433/7433 across 546 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-repair-spans
claim_status: planned
depends_on:
  - refactor-tutor-stub-guard-spans
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubGuardSpanProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubGuardSpanProjection.test.js
    - tests/tutorStubGuardAccounting.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-guard-spans
tags:
  - refactoring
  - tutor-stub
  - guard
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 3: move exact original-to-repair span projection beside the
guard-span projector while preserving the CLI's existing calls and accounting
schema.

Acceptance:

- Shared-prefix and shared-suffix projection remains exact in UTF-16 code-unit
  offsets, including insertions, deletions, unchanged text, and astral Unicode.
- Existing guard-accounting repair spans remain byte-for-byte compatible.
- The CLI strictly shrinks while generation, repair selection, accounting,
  runtime state, and effects stay in their current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing repair selection, diff granularity, guard findings, accounting
  schemas, candidate selection, or model behavior.

Log:

- 2026-07-28 — Activated from PR #351's reviewed head at `04afd35c`; the
  24,727-line CLI still owned exact original-to-repair span projection.
- 2026-07-28 — Moved the projector beside guard-span projection and pinned
  prefix/suffix preservation, UTF-16 offsets, insertions, deletions, unchanged
  text, and astral Unicode directly. The CLI shrank by 28 lines; 14 focused,
  7,433 root, and 137 tutor-core assertions pass with zero skips, together with
  every static and source-only gate.
