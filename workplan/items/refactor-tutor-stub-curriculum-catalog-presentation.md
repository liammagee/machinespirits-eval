---
id: refactor-tutor-stub-curriculum-catalog-presentation
title: Refactor tutor-stub curriculum catalogue presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: Curriculum catalogue output remains byte-identical while direct,
  canonical live-process, focused, hermetic, manifest, static, and source-only
  gates pass.
branch: codex/refactor-tutor-stub-curriculum-catalog-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-curriculum-progress-presentation
links:
  prs:
    - 334
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/curriculum/tutorStubCurriculumCatalogPresentation.js
    - services/curriculum/tutorStubCurriculum.js
    - scripts/tutor-stub.js
    - tests/tutorStubCurriculumCatalogPresentation.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-curriculum-progress-presentation
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
tags:
  - refactoring
  - tutor-stub
  - curriculum
  - presentation
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move only deterministic curriculum catalogue line projection
into a dependency-free presentation leaf while retaining curriculum loading,
public module normalization, command dispatch, terminal writes, live workplan
reads, runtime state, traces, and process-session transport in their current
owners.

Out of scope:

- Changing catalogue wording, state-field ordering, indentation, module order,
  source references, or newline behavior.
- Moving curriculum loading, module normalization, workplan reads, command
  handling, relaunch, runtime state, traces, or terminal ownership.
- Extracting `/module`, `/next`, or other command handlers before the
  browser/Electron acceptance gate is executable.
- Generalizing scenario, learner-profile, picker, or unrelated list output.

Acceptance:

- A dependency-free projector returns frozen catalogue line arrays without
  mutating its input.
- Direct fixtures pin curriculum/source headers, full/partial/absent module
  state, indentation, order, empty catalogues, and missing-input behavior.
- The CLI retains loading, public module normalization, terminal writes, and
  both existing catalogue call sites.
- The canonical AI Foundations catalogue remains exactly 28 lines and 852
  bytes with SHA-256
  `ded71f142f94e2960d289b988b0930bf5356c332b9fc831303be25e1b1aaacf7`.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-28 — Activated from rendered `origin/main` at `85888e45` after PR
  #329 merged with all ten CI lanes green. The browser/Electron acceptance gate
  remains triaged, so command/runtime movement remains excluded.
- 2026-07-28 — Before production edits, the canonical AI Foundations catalogue
  was pinned at 28 lines, 852 bytes, and SHA-256
  `ded71f142f94e2960d289b988b0930bf5356c332b9fc831303be25e1b1aaacf7`.
- 2026-07-28 — A 10-line dependency-free projector and 73-line direct/live
  test reduce `scripts/tutor-stub.js` from 25,135 to 25,131 lines. The exact
  852-byte catalogue hash remains unchanged; loading, normalization, both call
  sites, and terminal ownership remain in their existing owners.
- 2026-07-28 — Review parity is green on current `origin/main`: 30/30 focused
  catalogue/progress/registry/process-session assertions, all 7,400 root tests
  across 539 manifest files, and 137/137 tutor-core tests pass with zero skips.
  Manifest, 256-item source workplan, refs, lint, formatting, syntax, diff, and
  the zero-cycle ratchet across 417 files also pass.
- 2026-07-28 — Opened PR #334 from commit `12da9057`; the explicit workplan
  trailer and PR-body item link both name this card.
