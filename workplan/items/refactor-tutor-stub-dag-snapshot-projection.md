---
id: refactor-tutor-stub-dag-snapshot-projection
title: Refactor tutor-stub proof-DAG snapshot projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live technical tutor-DAG bytes remain identical while pure
  projection, focused, hermetic, manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-dag-snapshot-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-release-notes-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDagSnapshotPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubDagSnapshotPresentation.test.js
    - tests/tutorStubInteractivePerformance.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-release-notes-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - proof-dag
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic live tutor proof-DAG snapshot line
projection out of the CLI while retaining snapshot construction, state access,
terminal writes, commands, traces, and every runtime caller in the entrypoint.

Out of scope:

- Changing snapshot schemas, labels, release schedules, edge/leaf ordering,
  colors, wording, spacing, blank lines, or visibility rules.
- Moving DAG construction, committed-release lookup, next-release resolution,
  state access, technical-detail policy, slash-command execution, or terminal
  writes.
- Moving authored/learner proof inspection, semantic-web export, report,
  browser/voice, lifecycle, model, trace, or tutor-turn behavior.

Acceptance:

- One dependency-free pure projector receives the precomputed tutor-DAG
  snapshot and active color tokens.
- `buildTutorDagSnapshot` remains CLI-owned; `printTutorDagSnapshot` remains the
  terminal adapter used by every existing runtime caller.
- Frozen missing, non-derivable, derivable, scheduled/unscheduled, ruled/plain
  edge, and no-next-release fixtures pin exact bytes and input immutability.
- The actual pre/post-refactor interactive technical session exits zero with a
  byte-identical DAG block; focused/full hermetic and manifest, lint,
  formatting, cycle, source-only workplan, syntax, and diff gates pass without
  paid model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `040222c6` after PR
  #268 merged as `5bbd115c`. The CLI still owns snapshot construction and four
  runtime call sites; only the 29-line deterministic serializer is in scope.
- 2026-07-26 — Baseline fake-model live session produced a 1,388-byte,
  22-line tutor-DAG block with SHA-256
  `d6dafb632e9fb5e920609a48dda0c83cb1bd9a7edd6951130ec5f325836e4274`.
  Recorded exact process parity before moving presentation and made no paid
  model calls.
- 2026-07-26 — Added one dependency-free 41-line projection leaf and reduced
  the CLI from 26,618 to 26,591 lines. The original live block remains
  byte-identical at 1,388 bytes with its baseline SHA-256; a permanent
  explicit-pacing live fixture plus missing/non-derivable/derivable/no-next
  projections pass 6/6 and pin exact bytes, order, schedules, and blank lines.
- 2026-07-26 — Review parity is green: the complete hermetic root contract
  passes 6,961/6,961 across 499 files with zero skips and tutor-core passes
  137/137 with zero skips. ESLint, Prettier, the zero-cycle ratchet across 381
  files, synchronized test manifest, 209-item source-only workplan, syntax,
  and diff gates pass; generated workplan views remain untouched.
- 2026-07-26 — Rebased onto rendered `origin/main` at `4cebdde1` after PR #267
  replaced forced exit with runtime-specific natural-teardown diagnostics. The
  final-base focused suite passes 6/6; the new complete contract passes root
  6,976/6,976 across 499 files and tutor-core 137/137 with zero skips. Static,
  manifest, and 210-item source-only gates remain green.
