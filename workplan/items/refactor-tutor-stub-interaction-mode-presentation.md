---
id: refactor-tutor-stub-interaction-mode-presentation
title: Refactor tutor-stub interaction-mode presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live startup and mode-switch bytes remain identical while pure
  projection, focused, hermetic, manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-interaction-mode-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-proof-command-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInteractionModePresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubInteractionModePresentation.test.js
    - tests/tutorStubInteractiveDirection.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-proof-command-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - interaction-mode
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic interaction-mode label and banner
serialization out of the CLI while retaining mode mutation, prompt changes,
trace events, terminal writes, command handling, and automation in the
entrypoint.

Out of scope:

- Changing learner, mixed, coach, or auto mode behavior, defaults, transitions,
  prompt text, character selection, automated turn limits, or status data.
- Moving state access, `rl.setPrompt`, `interactive_mode_changed` trace events,
  slash-command dispatch, terminal writes, or automatic handoff execution.
- Changing colors, labels, descriptions, ordering, spacing, or trailing blank
  lines.

Acceptance:

- One dependency-free pure presentation leaf returns the existing mode label
  and banner lines from explicit mode, mixed-mode, detail, and color inputs.
- The CLI retains the state-reading label adapter and terminal-writing banner
  adapter, plus every mutation, prompt, trace, command, and automation effect.
- Frozen learner, mixed, coach, and auto fixtures pin exact bytes, colors,
  descriptions, detail branches, trailing blank lines, and input immutability.
- Actual pre/post-refactor startup, `/mode coach`, and `/mode learner` processes
  exit zero with byte-identical output; focused/full hermetic and manifest,
  lint, formatting, cycle, source-only workplan, syntax, and diff gates pass
  without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `839ec636` after PR
  #271 merged as `65e7b91f` with every CI lane green. Selected the shared pure
  mode label/banner seam used by startup, `/mode`, `/status`, and auto handoff;
  all state changes and runtime effects remain explicitly out of scope.
- 2026-07-26 — Baseline no-model startup learner banner is 63 bytes with
  SHA-256 `771bbcceab4d54f6fb259ff060aca848b688de72cdc340d2268973fd3e74bd58`;
  `/mode coach` is 190 bytes with SHA-256
  `0a5d427ded7beaa5b92f0f470c61c018a940b6dcc567b77a88f577e58c4ef7af`;
  `/mode learner` is 121 bytes with SHA-256
  `b7a7758ff80a94fdfdef2cc529dc75bc84c9f7e27e0d99ac2fdb1a5f406f97b1`.
- 2026-07-26 — Added one dependency-free 46-line presentation leaf and reduced
  the CLI from 26,562 to 26,556 lines. Learner, mixed, coach, auto, compact,
  real-process, ownership, interaction, and registry coverage passes 30/30;
  all three real no-model blocks retain their exact baseline bytes and hashes.
- 2026-07-26 — Review parity is green with permitted loopback access: the
  natural-teardown hermetic root contract passes 7,008/7,008 across 502 files
  with zero skips and tutor-core passes 137/137 with zero skips. ESLint,
  Prettier, the zero-cycle ratchet across 383 files, synchronized manifest,
  213-item source-only workplan, syntax, and diff gates pass; generated
  workplan views remain untouched. The restricted-sandbox precursor failed
  only where existing loopback suites received `listen EPERM`.
