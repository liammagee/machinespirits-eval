---
id: refactor-tutor-stub-training-reuse-presentation
title: Refactor tutor-stub training-reuse presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live candidate, owner opt-out, and external fail-closed training
  reuse status bytes remain identical while pure projection, focused, hermetic,
  manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-training-reuse-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-session-status-presentation
links:
  prs:
    - 276
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTrainingReusePresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubTrainingReusePresentation.test.js
    - tests/tutorStubTrainingReuse.test.js
    - tests/tutorStubLastSettings.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-session-status-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - data-governance
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the deterministic training-reuse status line
serialization shared by `/settings training-reuse` and the full `/settings`
summary out of the CLI while retaining already-resolved labels, policy state,
all effects, command dispatch, and terminal writes in the entrypoint.

Out of scope:

- Changing training eligibility, sole-owner opt-out, external/unknown fail-closed
  behavior, human-subject classification, defaults, or descendant policy.
- Moving normalization, policy resolution, state mutation, argument updates,
  remembered-settings persistence, trace events, command handling, or terminal
  writes.
- Changing colors, line order, conditional wording, diagnostic labels, or
  trailing blank lines.

Acceptance:

- One dependency-free pure presentation leaf returns training-reuse status
  lines from explicit, already-resolved labels, policy fields, and colors.
- The CLI retains live policy state, label resolution, persistence, trace
  provenance, command dispatch, and the terminal-writing adapter.
- Candidate, owner opt-out, fail-closed, and not-applicable fixtures pin exact
  lines and input immutability.
- Actual pre/post-refactor candidate, owner opt-out, and external-user status
  processes exit zero with byte-identical output; focused/full hermetic and
  manifest, lint, formatting, cycle, source-only workplan, syntax, and diff
  gates pass without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `9480bd7d` after PR
  #275 merged as `7ffbf1b8` with all ten final CI lanes green. Selected only
  the reusable training-reuse status serializer; policy, state, persistence,
  trace, commands, and terminal ownership remain explicitly out of scope.
- 2026-07-26 — Baseline no-model `/settings training-reuse status` is 210
  bytes with SHA-256
  `772098bccee3df25e15b5223f0199c7f1199f55eedaeb3a0f134d6964958e1f3`
  for the default owner candidate, 176 bytes with
  `a8e5f6794dc1266189f10a75e3a99dea3bbc97eccc5b23fcd741e9ec42d5aa39`
  for owner opt-out, and 172 bytes with
  `753ef493c427c455f9e5a0ea55425e58c16ee4e5033c64d7485a5f624e245f0f`
  for requested external-user reuse failing closed.
- 2026-07-26 — Added one dependency-free 34-line presentation leaf with no
  net CLI line growth. Candidate, owner opt-out, external fail-closed,
  not-applicable, real-process, policy, remembered-settings, trace, registry,
  and ownership coverage passes 39/39; all three live no-model blocks retain
  their exact baseline bytes and hashes.
- 2026-07-26 — Review parity is green: the permitted-loopback natural-teardown
  hermetic root contract passes 7,040/7,040 across 506 files with zero skips and
  tutor-core passes 137/137 with zero skips. ESLint, Prettier, the zero-cycle
  ratchet across 386 files, synchronized manifest, 217-item source-only
  workplan, syntax, and diff gates pass; generated workplan views remain
  untouched. The larger dialogue-settings projector is the logical next child
  after this slice merges.
- 2026-07-26 — PR #276 merged as `ccdf944e` after all ten CI lanes passed; the
  serialized workplan render followed as `c6cb954f`. This child is closed and
  the full dialogue-settings presentation child is active.
