---
id: refactor-tutor-stub-interim-frame-projection
title: Refactor tutor-stub interim frame projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: >-
  Frozen fixtures pin panel ordering, empty filtering, fallback behavior,
  rotation boundaries, spinner selection, elapsed formatting, every tone,
  phase compaction, terminal-width bounds, and exact ANSI composition; the
  real PTY loading scenario and full hermetic/static/source gates pass without
  model calls.
branch: codex/refactor-tutor-stub-interim-frame-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-interim-presentation
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInterimPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInterimPresentation.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - tests/tutorStubConcurrentTerminal.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interim-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - terminal
  - loading-indicator
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's pure interim panel ordering and ANSI
frame serialization into the existing presentation leaf, without moving live
field/DAG calculations or animation and terminal behavior.

Out of scope:

- Changing panel labels, tones, order, empty filtering, fallback copy, spinner
  selection, four-tick rotation, phase compaction, elapsed formatting, color,
  width bounds, or truncation.
- Moving lightweight-field, DAG, clue-release, learner-classification,
  register, or capability calculations out of the CLI.
- Moving tick mutation, time reads, TTY detection, timers, terminal writes,
  concurrent-terminal coordination, commands, model calls, traces, or mutable
  runtime state.
- Redesigning the loading indicator or running model-backed evaluations.

Acceptance:

- One pure projection orders and filters already-computed panel values with the
  same authored labels and active-checks fallback.
- One pure renderer accepts explicit tick/time/width/frame/color inputs and
  returns the byte-identical interim terminal row.
- The CLI retains all live summary computation and every animation/runtime
  effect, passing snapshots into the pure leaf behind the same call sites.
- Frozen fixtures cover ordering, filtering, immutability, fallback, rotation,
  timing, spinner, colors, phase/text truncation, width bounds, and exact ANSI.
- The real PTY loading scenario plus focused, hermetic, manifest, lint,
  formatting, cycle, source-only workplan, syntax, and diff gates pass without
  model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `315cbaed` after PR
  #249 merged with every CI lane green. Selected the pure panel/frame seam so
  live DAG/field calculations, animation state, timers, TTY I/O, commands,
  traces, and model/runtime behavior remain with the CLI.
- 2026-07-26 — Added pure panel and frame projections to the existing
  presentation leaf, reducing the CLI from 27,013 to 26,984 lines. Nineteen
  focused projection/summary/terminal tests and the real PTY loading scenario
  pass with exact ANSI, timing, rotation, color, truncation, fallback, and
  immutability behavior pinned.
- 2026-07-26 — Review parity is green: the complete hermetic root suite passes
  6,871/6,871 with zero skips and tutor-core passes 137/137 with zero skips.
  ESLint, Prettier, the zero-cycle ratchet across 368 files, synchronized test
  manifest, 199-item source-only workplan, syntax, and diff gates pass without
  model calls.
- 2026-07-26 — Rebased cleanly onto `origin/main` at `7c3904ff` after PRs #250
  and #251 merged the tutor PR benchmark and tutor self-correction disclosure.
  The final-base overlap set passes 155/155 plus the real PTY loading scenario;
  the complete hermetic suite is zero-skip green at root 6,834/6,834 and
  tutor-core 137/137. ESLint, Prettier, zero-cycle (371 files), manifest,
  200-item source-only workplan, syntax, and diff gates pass on the final base.
- 2026-07-26 — Final remote refresh rebased cleanly onto `origin/main` at
  `0eeff71a` after independent PR #252 added the negative-register effect grid.
  It does not overlap this slice; the 19/19 focused set, 200-item source-only
  workplan, and diff gate remain green after that rebase.
