---
id: refactor-tutor-stub-picker-presentation
title: Refactor tutor-stub picker presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Launch, scenario, and curriculum picker lines remain exact while
  direct immutable projection, live PTY, focused, hermetic, manifest, static,
  and source-only gates pass.
branch: codex/refactor-tutor-stub-picker-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-world-catalog-presentation
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubPickerPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubPickerPresentation.test.js
    - tests/labellingGameCli.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-world-catalog-presentation
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
tags:
  - refactoring
  - tutor-stub
  - picker
  - presentation
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic launch-mode, scenario, and curriculum
picker line projection into one side-effect-free owner while retaining entry
loading, grouping, viewport and selection mutation, key handling, raw-mode
lifecycle, listener restoration, commands, and terminal clearing/writes in the
CLI.

Out of scope:

- Changing picker wording, order, padding, truncation, colors, width bounds,
  viewport size, scrolling, selection defaults, or optional detail lines.
- Moving input listeners, raw mode, cursor control, output writes, scenario or
  curriculum loading, command handlers, or runtime state.
- Extracting `/scenario`, curriculum, or launch-mode command orchestration
  before the browser/Electron acceptance gate is executable.
- Changing learner-profile picker presentation, which already has a separate
  owner and contract.

Acceptance:

- Pure projectors preserve exact narrow/wide width behavior, selected-row
  color tokens, viewport boundary counts, and label/detail truncation.
- Scenario lines preserve question, setting, and discipline details; curriculum
  lines preserve state fallback and optional completion verification.
- Projectors return frozen line arrays and do not mutate frozen entries.
- The CLI retains all selection, keypress, listener, raw-mode, viewport,
  loading, and terminal-effect ownership.
- Existing launch-mode and fresh-session PTY tests pass unchanged alongside
  direct dense, sparse, colored, and narrow-width fixtures.
- `scripts/tutor-stub.js` and each touched keyboard picker function strictly
  shrink without changing the command or trace surface.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-28 — Activated from merged `origin/main` at `2275c789` after PR #338.
  The pre-edit CLI was 25,107 lines; launch, scenario, and curriculum keyboard
  functions were 87, 134, and 123 lines. All 49 existing focused PTY assertions
  passed before production edits.
- 2026-07-28 — Added a 119-line side-effect-free presentation owner and
  140-line direct test. The CLI is now 25,069 lines; the three keyboard
  functions shrink to 80, 118, and 103 lines while all 53 direct and PTY
  assertions pass.
- 2026-07-28 — Review parity is green: all 7,413 root assertions across 541
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 259-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 420 files also pass. An initial three-file
  failure was traced to the stable checkout's stale shared dependency tree;
  `npm ci` restored the declared SHACL and MCP packages, after which those 19
  assertions and the complete suite passed.
