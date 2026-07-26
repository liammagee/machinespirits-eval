---
id: refactor-tutor-stub-dialogue-settings-presentation
title: Refactor tutor-stub dialogue-settings presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live default and configured /settings bytes remain identical
  while pure projection, focused, hermetic, manifest, static, and source-only
  gates pass.
branch: codex/refactor-tutor-stub-dialogue-settings-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-training-reuse-presentation
links:
  prs:
    - 280
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDialogueSettingsPresentation.js
    - services/tutorStubTrainingReusePresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubDialogueSettingsPresentation.test.js
    - tests/tutorStubTrainingReusePresentation.test.js
    - tests/tutorStubLastSettings.test.js
    - tests/tutorStubCommandRegistry.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-training-reuse-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - settings
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the complete deterministic normal-session `/settings`
line serialization out of the CLI while retaining live snapshot derivation,
the already-extracted training-reuse projector, commands, setting changes,
persistence, traces, model resolution, picker behavior, and terminal writes in
their existing owners.

Out of scope:

- Changing any setting, default, model role, policy stack, style range, random
  or directed performance behavior, light adaptation, dropout, pacing,
  training-reuse policy, appearance, committee, or remembered-settings state.
- Moving state access, domain helper calls, slash dispatch, setting mutation,
  interactive pickers, persistence, trace events, model calls, or terminal
  writes.
- Changing colors, line ordering, wording, spacing, role modes, command hints,
  or trailing blank lines.

Acceptance:

- One pure presentation service returns the complete settings line array from
  an explicit, already-resolved settings snapshot, composed training-reuse
  lines, and colors.
- The CLI retains every state/helper lookup, the `/settings` command paths,
  mutations and side effects, and the terminal-writing adapter.
- Default, combined-role, directed-axis, random-axis, disabled-control,
  remembered-state, dropout, pacing, and policy fixtures pin exact bytes,
  conditional wording, frozen results, and input immutability.
- Actual pre/post-refactor default and configured `/settings` processes exit
  zero with byte-identical output; focused/full hermetic and manifest, lint,
  formatting, cycle, source-only workplan, syntax, and diff gates pass without
  model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `c6cb954f` after PR
  #276 merged as `ccdf944e` with all ten CI lanes green. Selected only the
  normal-session settings serializer; live resolution and every effect remain
  explicitly out of scope.
- 2026-07-26 — Baseline no-model `/settings` is 2,131 bytes over 23 lines with
  SHA-256
  `8b1e655838355028d7562d4b3cc135ab41567b286e51c78fdddc4fccb453c03a`
  under interactive defaults, and 1,960 bytes over 23 lines with
  `62ee02afda20311a0b6ac1af068e8373dd7bb5a3ffdb5e94448047ce0d2b543c`
  under disabled committee/light adaptation, owner opt-out, dynamical-state
  policy, range 0.55, dropout 0.25, pacing 1.5, and full parchment presentation.
- 2026-07-26 — Added one dependency-free 74-line presentation service and
  reduced the CLI by 26 lines. Default, combined-role, directed-axis,
  random-axis, disabled-control, remembered-state, real-process, training-reuse,
  persistence, trace, command, and ownership coverage passes 44/44; both live
  `/settings` blocks retain their exact baseline bytes and hashes.
- 2026-07-26 — Review parity is green: the permitted-loopback natural-teardown
  hermetic root contract passes 7,045/7,045 across 507 files with zero skips and
  tutor-core passes 137/137 with zero skips. ESLint, Prettier, the zero-cycle
  ratchet across 387 files, synchronized manifest, 218-item source-only
  workplan, syntax, and diff gates pass; generated workplan views remain
  untouched.
- 2026-07-26 — Rebased onto `origin/main` at `8ad346a2` after PR #277 added the
  independent Program-2 launch-certificate contract. The incoming four-file
  set does not overlap this slice; its tests plus the presentation/policy set
  pass 59/59, and final-base hermetic parity passes 7,048/7,048 root tests plus
  137/137 tutor-core tests with zero skips.
- 2026-07-26 — PR #280 merged as `955a4ec1` with all ten CI lanes green; the
  serialized workplan render followed as `911de566`. This child is closed and
  the model-choice presentation child is active.
