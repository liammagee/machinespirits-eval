---
id: refactor-tutor-stub-interactive-help-projection
title: Refactor tutor-stub interactive help projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Normal and passthrough /help output remains byte-identical while
  pure projection, focused, hermetic, manifest, static, and source-only gates
  pass.
branch: codex/refactor-tutor-stub-interactive-help-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-cli-help-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubInteractiveHelp.js
    - scripts/tutor-stub.js
    - tests/tutorStubInteractiveHelp.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-cli-help-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - help
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the tutor-stub's pure interactive `/help` line
projection out of the CLI while retaining command availability, capability
resolution, terminal writes, and every runtime responsibility in the
entrypoint.

Out of scope:

- Changing help copy, group ordering, command tokens, aliases, completion,
  availability, capability requirements, colors, padding, or blank lines.
- Moving command registry queries, slash-command execution, palette rendering,
  state mutation, terminal writes, traces, model calls, or session behavior.
- Moving feature-map, release-note, settings, report, browser/voice, lifecycle,
  or tutor-turn behavior.

Acceptance:

- One dependency-free pure projector receives precomputed help rows, explicit
  availability flags, learning-summary state, and the active color tokens.
- `printInteractiveHelp` remains the CLI-owned adapter that resolves mode,
  capabilities, registry availability, and writes every projected line.
- Frozen normal and passthrough fixtures pin exact bytes, conditional sections,
  row order/padding, trailing blank lines, and input immutability.
- Existing real CLI `/help` coverage plus focused and full hermetic tests and
  manifest, lint, formatting, cycle, source-only workplan, syntax, and diff
  gates pass without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `85ccfb7a` after PR
  #262 merged as `cb1ab520` with every CI lane green. Selected the remaining
  pure `/help` copy/line projection so command availability, terminal output,
  completion, slash dispatch, traces, models, and runtime state stay CLI-owned.
- 2026-07-26 — Added one dependency-free 91-line projection leaf and reduced
  the CLI from 26,713 to 26,658 lines. Normal and passthrough process output is
  byte-identical at 5,103 and 1,293 bytes respectively; 66 direct, registry,
  real `/help`, and terminal interaction tests pass with every conditional
  section, padding rule, trailing blank line, and ownership boundary pinned.
- 2026-07-26 — Review parity is green: the complete hermetic root suite passes
  6,920/6,920 with zero skips and tutor-core passes 137/137 with zero skips.
  ESLint, Prettier, the zero-cycle ratchet across 378 files, synchronized test
  manifest, 205-item source-only workplan, syntax, and diff gates pass without
  model calls; generated workplan views remain untouched.
- 2026-07-26 — Fast-forwarded to rendered `origin/main` at `69c0ee37` after
  PRs #263–#264 and the serialized workplan refresh. The only source overlap,
  the independent due-source presentation change in `scripts/tutor-stub.js`,
  composed cleanly. The final-base help/registry/terminal surface passes 60/60;
  the complete hermetic root contract passes all 6,907 tests with zero skips
  and tutor-core passes 137/137 with zero skips.
