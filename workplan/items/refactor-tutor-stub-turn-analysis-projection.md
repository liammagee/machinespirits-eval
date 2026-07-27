---
id: refactor-tutor-stub-turn-analysis-projection
title: Refactor tutor-stub current-turn analysis presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Learner-facing /analysis lines remain byte-identical while
  focused, seeded live-process, hermetic, manifest, static, and source-only
  gates pass.
branch: codex/refactor-tutor-stub-turn-analysis-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-analysis-vocabulary
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTurnAnalysisPresentation.js
    - services/tutorStubResponseDetails.js
    - scripts/tutor-stub.js
    - tests/tutorStubTurnAnalysisPresentation.test.js
    - tests/tutorStubResponseDetails.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-analysis-vocabulary
tags:
  - refactoring
  - tutor-stub
  - presentation
  - analysis
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the deterministic learner-facing current-turn analysis
line projection out of the CLI while retaining live-state normalization,
technical analysis, slash-command dispatch, and terminal writes in their
existing owner.

Out of scope:

- Changing learner classification, register selection or efficacy, field/DAG
  state, response checks, policy signals, clue pacing, or dialogue closure.
- Moving `printCurrentTurnTechnicalAnalysis`, explanatory debug, normalization,
  slash dispatch, runtime state, traces, terminal concurrency, or model calls.
- Changing labels, ordering, omissions, the three-signal/0.15 policy threshold,
  whitespace compaction, 220-character truncation, fallbacks, or ANSI bytes.

Acceptance:

- One pure presentation service projects the existing learner-facing analysis
  lines from explicit normalized inputs and performs no effects.
- The CLI retains technical-mode dispatch, stored-state normalization,
  distribution formatting, live register fallback, and all terminal writes.
- Empty, dense, sparse, question-support, efficacy, policy-signal, jargon,
  immutability, and exact terminal-byte branches have direct fixtures.
- A seeded fake-provider completed turn has the same output bytes and hash on
  pre-extraction `main` and this branch without external model or API calls.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `af137b0f` after PR
  #313 merged as `91893217` with all ten CI lanes green. Selected only
  `printCurrentTurnAnalysis`; the larger technical and explanatory-debug
  renderers remain CLI-owned.
- 2026-07-27 — Added a 286-line pure projector and 238-line direct test file,
  reducing `scripts/tutor-stub.js` by 186 net lines. The dense and sparse
  fixtures pin every learner-facing branch, while a seeded no-classifier live
  turn matches pre-extraction `main` at 1,093 bytes and SHA-256
  `a379dd60b84a554b4e79a4ad00bcf2d294aaa2a9751112f50148f4b14ad303b9`.
- 2026-07-27 — Reached review with 66/66 focused assertions, all 7,320 root
  tests across 529 manifest files, and 137/137 tutor-core tests passing with
  zero skips. The 242-item source-only workplan, synchronized manifest,
  current ref registry, ESLint, Prettier, syntax, diff, and zero-cycle ratchet
  across 409 files are green on `origin/main` at `af137b0f`.
