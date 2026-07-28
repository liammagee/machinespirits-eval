---
id: refactor-tutor-stub-dag-snapshot-model
title: Refactor tutor-stub DAG snapshot model
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 8/8 including byte-exact live Marrick block; hermetic root 7454/7454 across 551 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-dag-snapshot-model
claim_status: planned
depends_on:
  - refactor-tutor-stub-dag-memory-reliability
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDagSnapshotPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubDagSnapshotPresentation.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-dag-memory-reliability
    - refactor-tutor-stub-dag-snapshot-projection
tags:
  - refactoring
  - tutor-stub
  - dag
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 10: move deterministic tutor-DAG snapshot data-model
projection beside its previously extracted terminal presentation, leaving
state and release selection in the CLI wrapper.

Acceptance:

- Root, node, edge, fact, leaf, release, unknown-reference, missing-input, and
  no-next-release contracts remain exact.
- The live Marrick technical terminal block remains byte-identical.
- The CLI strictly shrinks while tutor-DAG construction, release scheduling,
  state access, terminal writes, runtime callers, and effects stay in current
  owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing DAG construction, release scheduling, proof semantics, terminal
  bytes, technical analysis, dialogue closure, or model behavior.

Log:

- 2026-07-28 — Activated from PR #358's reviewed head at `288bc591`; the
  24,484-line CLI still owned deterministic tutor-DAG snapshot model
  projection. The completed 2026-07-26 `dag-snapshot-projection` card remains
  the distinct terminal-line presentation slice.
- 2026-07-28 — Moved the complete pure snapshot model beside its byte-exact
  terminal projection and retained only state/release selection in the CLI.
  The CLI shrank by 61 lines; eight focused, 7,454 root, and 137 tutor-core
  assertions pass with zero skips, together with every static and source-only
  gate.
