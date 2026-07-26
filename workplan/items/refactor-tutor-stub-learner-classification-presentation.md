---
id: refactor-tutor-stub-learner-classification-presentation
title: Refactor tutor-stub learner-classifier presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Live technical-debug learner-classifier bytes remain identical
  while pure projection, focused, hermetic, manifest, static, and source-only
  gates pass.
branch: codex/refactor-tutor-stub-learner-classification-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-learner-dag-presentation
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearnerClassificationPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearnerClassificationPresentation.test.js
    - tests/tutorStubLearnerDagPresentation.test.js
    - tests/tutorStubInteractivePerformance.test.js
    - tests/tutorStubMultiPremiseAdvance.test.js
    - services/__tests__/tutorStubPublicLearnerAnalysis.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-learner-dag-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - learner-classifier
  - debug
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic technical learner-classifier diagnostic
serialization out of the CLI while retaining classification, score
normalization, pedagogical-need and warning resolution, debug gating, call
sites, traces, and terminal writes in their existing owners.

Out of scope:

- Changing classifier prompts, provider schemas, parsing, fallbacks, scores,
  request types, discourse moves, epistemic stance, pace, reasoning span,
  pedagogical need, or warnings.
- Moving classifier calls, classifier postprocessing, state mutation,
  `printAutomaticTechnicalDetails`, debug commands, traces, or terminal writes.
- Changing colors, labels, ordering, fallback values, punctuation, or when
  private diagnostics become visible.

Acceptance:

- One dependency-free pure presentation leaf returns frozen line arrays from
  an explicit normalized learner-classifier presentation and color palette.
- The CLI retains classifier execution and parsing, score normalization,
  pedagogical-need and warning resolution, automatic debug gates, call sites,
  and terminal adapters.
- Full/minimal, pace, reasoning-span, tutor-cue, warning, and immutability
  fixtures pin exact bytes.
- An actual fake-provider technical-debug process exits zero with
  byte-identical learner-classifier output; focused/full hermetic and manifest,
  lint, formatting, cycle, source-only workplan, syntax, and diff gates pass.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `e2a7cd75` after PR
  #289 merged as `26503b06` with all ten CI lanes green. Selected only the
  normalized technical line serializer; classification, score and warning
  semantics, debug gating, callers, traces, and terminal ownership remain
  explicitly out of scope.
- 2026-07-27 — Baseline fake-provider Marrick technical classifier output is
  488 bytes over five lines with SHA-256
  `2cb87d9a99f0e6c52383a183c0524f75ade9759f23fa0915a6f8ffc407c98ded`,
  including the existing prompt-budget warning path.
- 2026-07-27 — Added one dependency-free 31-line presentation leaf and reduced
  the CLI by seven net lines. Full/minimal projections, pace, reasoning span,
  tutor cues, warnings, immutability, ownership, and the real technical-debug
  process pass 118/118 focused assertions; the live block retains its exact
  baseline bytes and hash. Initial-base parity passes 7,210/7,210 root tests
  across 520 files plus 137/137 tutor-core tests, both with zero skips. The
  synchronized manifest, 227-item source-only workplan, ESLint, Prettier,
  zero-cycle ratchet across 402 files, syntax, and diff gates pass.
- 2026-07-27 — Rebased onto `origin/main` at `f32ffbb7` after PRs #288, #290,
  and #291. The sole manifest overlap composed cleanly; classifier,
  gate-grader, response-composition, and showcase coverage passes 295/295.
  Final-base parity passes 7,229/7,229 root tests across 521 files plus 137/137
  tutor-core tests, both with zero skips. Manifest, source-only workplan, and
  diff gates remain green.
