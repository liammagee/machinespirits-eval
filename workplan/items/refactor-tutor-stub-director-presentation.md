---
id: refactor-tutor-stub-director-presentation
title: Refactor tutor-stub director presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Live director-context and issued-note bytes remain identical
  while pure projection, focused, hermetic, manifest, static, and source-only
  gates pass.
branch: codex/refactor-tutor-stub-director-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-model-choice-presentation
links:
  prs:
    - 286
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDirectorPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubDirectorPresentation.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
    - tests/tutorStubTranscriptHtml.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-model-choice-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - director
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic initial director-context and issued-note
serialization out of the CLI while retaining director state construction,
issued-note derivation, future-note withholding, trace recording, slash
dispatch, and terminal writes in their existing owners.

Out of scope:

- Changing the initial context, public audience context, issued-note schema,
  committed-release selection, note ordering, or future-note withholding.
- Moving world/state access, release derivation, cloning, state mutation,
  trace events, `/director` dispatch, or terminal writes.
- Changing colors, labels, indentation, multiline handling, footer wording,
  blank lines, startup ordering, or transcript behavior.

Acceptance:

- One dependency-free pure presentation leaf returns frozen line arrays for an
  explicit director context or issued-note projection.
- The CLI retains initial-context construction, issued-note derivation,
  opening-presentation state, trace events, `/director`, and terminal adapters.
- Empty, opening, multiline, audience, released-scene-note, and completed-turn
  fixtures pin exact bytes and input immutability.
- Actual pre/post-refactor initial context and `/director` reprise processes
  exit zero with byte-identical output; focused/full hermetic and manifest,
  lint, formatting, cycle, source-only workplan, syntax, and diff gates pass
  without model calls.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `46fd7e0e` after PR
  #285 merged as `b2bb02a3` with all ten CI lanes green. Selected only the two
  director line serializers; note derivation, future-note withholding,
  trace/state effects, commands, and terminal ownership remain explicitly out
  of scope.
- 2026-07-27 — Baseline no-model Marrick director context is 1,463 bytes over
  seven lines with SHA-256
  `c2682db022585f73378c0b5c20ea02616fc1f61055618b206c6f0af27ce66484`;
  its opening-only `/director` reprise is 1,541 bytes over nine lines with
  `5fcedc2e33e8d2a98b1c1399928d49eb69f77ea73f06e050d4c936e4f8bd5e4e`.
- 2026-07-27 — Added one dependency-free 57-line presentation leaf and reduced
  the CLI by 35 net lines. Multiline context, audience, empty/opening/released
  notes, completed-turn footer, immutability, ownership, and real-process
  coverage passes 67/67; both live blocks retain their exact baseline bytes and
  hashes.
- 2026-07-27 — Rebased onto `origin/main` at `29335ef3` after PRs #283 and #284.
  The CLI changes composed automatically; the shared hermetic manifest was
  regenerated from the combined test tree. Incoming instrumentation,
  passthrough, guard, pacing, learning-summary, capability, and director
  overlap passes 281/281. Final-base parity passes 7,193/7,193 root tests across
  517 files plus 137/137 tutor-core tests, both with zero skips. The synchronized
  manifest, 225-item source-only workplan, ESLint, Prettier, zero-cycle ratchet
  across 399 files, syntax, and diff gates pass.
- 2026-07-27 — PR #286 merged as `c05444f6` with all ten CI lanes green; the
  serialized generated-workplan refresh followed as `f628fe85`.
