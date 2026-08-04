---
id: refactor-tutor-stub-launch-mode-contract
title: Refactor tutor-stub launch-mode contract
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: Launch modes, aliases, errors, and live TTY transitions remain
  exact across direct, PTY, focused, hermetic, manifest, static, and source-only
  gates.
branch: codex/refactor-tutor-stub-launch-mode-contract
claim_status: planned
depends_on:
  - refactor-tutor-stub-world-vocabulary
links:
  prs:
    - 343
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLaunchMode.js
    - services/tutorStubPickerPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubLaunchMode.test.js
    - tests/labellingGameCli.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-world-vocabulary
tags:
  - refactoring
  - tutor-stub
  - launch
  - mode
  - terminal
milestone: evaluation-infrastructure
---

Dependent R3 slice: move the two authored launch modes and their pure alias
normalization into a dependency-free contract while retaining TTY admission,
picker projection, key handling, raw mode, dispatch, process arguments, and
terminal effects in the CLI.

Acceptance:

- Catalogue order, IDs, labels, and descriptions remain deep-equal.
- Chat and labelling spelling/spacing aliases resolve exactly; empty admission
  and exact unknown-mode errors are pinned.
- The live launch picker still enters labelling, returns, and launches default
  mixed chat under the existing PTY test.
- The CLI strictly shrinks without changing dispatch, arguments, state, traces,
  commands, or terminal effects.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Adding modes or aliases, changing defaults, picker text, TTY behavior,
  labelling behavior, commands, process launch, or runtime state.

Log:

- 2026-07-28 — Activated from PR #342's reviewed head at `3bb5cd41`; the
  25,024-line CLI still owned the 36-line launch catalogue/normalizer seam.
- 2026-07-28 — Added a 36-line dependency-free contract and 34-line direct
  test, registered it in the hermetic manifest, and reduced the CLI to 24,989
  lines. All 14 direct, picker, and live PTY assertions pass.
- 2026-07-28 — Review parity is green: 7,418/7,418 root assertions across 542
  manifest files and 137/137 tutor-core assertions pass with zero skips.
  Manifest, 263-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 421 files also pass.
- 2026-07-28 — Opened dependent PR #343 on PR #342's branch with no managed ref
  or version impact.
