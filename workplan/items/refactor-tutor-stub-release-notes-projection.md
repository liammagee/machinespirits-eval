---
id: refactor-tutor-stub-release-notes-projection
title: Refactor tutor-stub release-notes projection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live /release-notes output remains byte-identical while pure
  projection, focused, hermetic, manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-release-notes-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-feature-map-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubReleaseNotes.js
    - services/tutorStubReleaseNotesPresentation.js
    - scripts/tutor-stub.js
    - services/__tests__/tutorStubReleaseNotes.test.js
    - tests/tutorStubReleaseNotesPresentation.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - tests/tutorStubPassthrough.test.js
    - config/hermetic-test-manifest.json
  prs:
    - 268
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-feature-map-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - release-notes
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic in-session `/release-notes` line
projection out of the CLI while retaining hour normalization, Git-history
loading, terminal writes, and every runtime responsibility in the entrypoint.

Out of scope:

- Changing release-note relevance, grouping, group order, effect/look-for copy,
  commit visibility limits, pluralization, colors, spacing, or blank lines.
- Moving Git subprocesses, time-window validation, commit parsing, note-model
  construction, slash-command execution, return values, or terminal writes.
- Moving capability/help, settings, reports, browser/voice, lifecycle, model,
  trace, or tutor-turn behavior.

Acceptance:

- One dependency-free pure projector receives the precomputed note model and
  active color tokens.
- `printTutorStubReleaseNotes` remains the CLI-owned adapter that normalizes the
  window, loads Git-backed notes, writes every projected line, and returns the
  note model.
- Frozen empty and multi-group fixtures pin exact bytes, singular/plural copy,
  validation/non-validation visibility limits, overflow counts, trailing blank
  lines, and input immutability.
- The actual pre/post-refactor live process exits zero with byte-identical
  `/release-notes` output; focused/full hermetic and manifest, lint, formatting,
  cycle, source-only workplan, syntax, and diff gates pass without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `fb809c05` after PR
  #266 merged as `d21da873` with every required CI lane green. The existing
  release-note service already owns Git loading, parsing, grouping, and effect
  policy, leaving a bounded deterministic serialization seam in the CLI.
- 2026-07-26 — Baseline live process output is 3,965 bytes, including a
  2,697-byte 168-hour release-note slice. Recorded exact SHA-256 parity before
  moving the presentation and made no model calls.
- 2026-07-26 — Added one dependency-free 43-line projection leaf and reduced
  the CLI from 26,642 to 26,618 lines. The live process remains byte-identical
  at 3,965 bytes with the same 2,697-byte release-note slice. Exact empty and
  grouped fixtures plus loader, normal-session, and passthrough coverage pass
  54/54.
- 2026-07-26 — Review parity is green: the complete hermetic root contract
  passes 6,913/6,913 with zero skips and tutor-core passes 137/137 with zero
  skips. ESLint, Prettier, the zero-cycle ratchet across 380 files, synchronized
  test manifest, 208-item source-only workplan, syntax, and diff gates pass;
  generated workplan views remain untouched.
- 2026-07-26 — PR #268 merged as `5bbd115c`; the serialized workplan render
  followed as `040222c6`. Closed this child and handed the next pure R3
  presentation seam to `refactor-tutor-stub-dag-snapshot-projection`. One
  pre-merge Node 20 shard reported a failure, so the next child retains the
  complete local hermetic contract as an explicit regression gate.
