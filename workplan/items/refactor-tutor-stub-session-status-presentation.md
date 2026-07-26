---
id: refactor-tutor-stub-session-status-presentation
title: Refactor tutor-stub session-status presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live normal and passthrough /status bytes remain identical while
  pure projection, focused, hermetic, manifest, static, and source-only gates
  pass.
branch: codex/refactor-tutor-stub-session-status-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-interaction-mode-presentation
links:
  prs:
    - 275
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubSessionStatusPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubSessionStatusPresentation.test.js
    - tests/tutorStubInteractiveDirection.test.js
    - tests/tutorStubPassthrough.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-interaction-mode-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - status
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic normal and passthrough `/status` line
serialization out of the CLI while retaining live state derivation, helper
calls, slash-command dispatch, and terminal writes in the entrypoint.

Out of scope:

- Changing any status label, model-role lookup, policy or DAG snapshot,
  interaction state, default, command, trace, prompt, or runtime behavior.
- Moving state access, dropout/release calculations, profile selection,
  explicit-directive resolution, role routing, director-text truncation,
  feedback envelopes, command handling, or terminal writes.
- Changing colors, line ordering, conditional wording, spacing, or trailing
  blank lines.

Acceptance:

- One dependency-free pure presentation leaf returns normal or passthrough
  status lines from an explicit, already-resolved status snapshot and colors.
- The CLI retains both state-snapshot construction branches, every helper call,
  the `/status` command path, and the terminal-writing adapter.
- Frozen passthrough, default normal, directed/canary, random-axis, and queued
  handoff fixtures pin exact bytes, branch wording, line counts, and input
  immutability.
- Actual pre/post-refactor normal and passthrough `/status` processes exit zero
  with byte-identical output; focused/full hermetic and manifest, lint,
  formatting, cycle, source-only workplan, syntax, and diff gates pass without
  model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `740a0981` after PR
  #273 merged as `c074469c` with every CI lane green. Selected only the two
  deterministic status serializers; live session resolution and effects remain
  explicitly out of scope.
- 2026-07-26 — Baseline no-model normal `/status` is 1,346 bytes with SHA-256
  `49b25a1d28e2a5062179c34adb1b7f8083192f44ca90a4c7e2401b01653bbea4`;
  passthrough `/status` is 406 bytes with SHA-256
  `8756733576dddd064fd719af5324cf0d13735932f01100af9f0d1d14bc704e00`.
- 2026-07-26 — Added one dependency-free 76-line presentation leaf and reduced
  the CLI from 26,556 to 26,527 lines. Passthrough, default, directed/canary,
  queued-handoff, real-process, ownership, interaction, passthrough, and
  registry coverage passes 39/39; both real no-model blocks retain their exact
  baseline bytes and hashes.
- 2026-07-26 — Review parity is green: the permitted-loopback natural-teardown
  hermetic root contract passes 7,022/7,022 across 504 files with zero skips and
  tutor-core passes 137/137 with zero skips. ESLint, Prettier, the zero-cycle
  ratchet across 384 files, synchronized manifest, 215-item source-only
  workplan, syntax, and diff gates pass; generated workplan views remain
  untouched.
- 2026-07-26 — PR #275 merged as `7ffbf1b8`; the serialized workplan render
  followed as `9480bd7d`. All ten final CI lanes are green, so this child is
  closed and the bounded training-reuse presentation child is active.
