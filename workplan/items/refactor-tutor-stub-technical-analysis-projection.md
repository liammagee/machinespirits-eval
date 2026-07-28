---
id: refactor-tutor-stub-technical-analysis-projection
title: Refactor tutor-stub technical analysis presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Technical /analysis output remains byte-identical while dense,
  sparse, seeded live-process, focused, hermetic, manifest, static, and
  source-only gates pass.
branch: codex/refactor-tutor-stub-technical-analysis-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-turn-analysis-projection
links:
  prs:
    - 317
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubTechnicalAnalysisPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubTechnicalAnalysisPresentation.test.js
    - tests/tutorStubDagSnapshotPresentation.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-turn-analysis-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - analysis
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the deterministic operator-facing technical `/analysis`
line projection out of the CLI while retaining live-state normalization, field
construction, trace-path resolution, slash-command dispatch, and terminal
writes in their existing owner.

Out of scope:

- Changing classifier, learner-DAG, register, efficacy, field, tutor-DAG,
  response-check, human-discourse, or dialogue-closure data.
- Moving explanatory debug, state/default owners, field construction, trace
  resolution, normalization, slash dispatch, terminal concurrency, traces,
  filesystem access, or model calls.
- Changing labels, ordering, omissions, whitespace compaction,
  220-character truncation, fallbacks, nested DAG bytes, or ANSI bytes.

Acceptance:

- One deterministic presentation service projects the complete technical
  analysis block from explicit prepared inputs and returns frozen lines.
- The CLI retains normalized register/efficacy state, field construction,
  trace resolution, runtime fallbacks, technical dispatch, and all terminal
  writes.
- Empty, dense, sparse, classifier, learner-DAG, register-policy, field,
  response-check, tutor-DAG, human-discourse, closure, immutability, and exact
  terminal-byte branches have direct fixtures.
- A seeded fake-provider completed turn has the same normalized output bytes
  and hash on pre-extraction PR #316 and this branch without external model or
  API calls.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `07caedf8` after PR
  #316 merged as `86bb2147` with all ten CI lanes green. Selected only
  `printCurrentTurnTechnicalAnalysis`; explanatory-debug calculations,
  effects, traces, and terminal concurrency remain CLI-owned.
- 2026-07-27 — The seeded no-classifier Marrick fixture is byte-identical to
  pre-extraction PR #316 after normalizing the generated run/trace identifiers:
  2,787 bytes and SHA-256
  `7c7c0b9c4eb55a9c075873d3f2a1711b4c30ce5d3e8c630367a7bbf11aca6778`.
- 2026-07-27 — Added a 566-line deterministic projector and 371-line direct
  test file, reducing `scripts/tutor-stub.js` by 410 net lines. Dense fixtures
  pin classifier, learner-DAG, policy, field, guard, tutor-DAG,
  human-discourse, closure, immutability, and exact-byte branches; the existing
  fake-provider harness pins 2,756 normalized live bytes at SHA-256
  `323aa92b35cd3e144111afe4b848bd9844819671548e4a45511740e0e498f12d`.
- 2026-07-27 — Reached review with 30/30 focused assertions, all 7,323 root
  tests across 530 manifest files, and 137/137 tutor-core tests passing with
  zero skips. The 243-item source-only workplan, synchronized manifest,
  ref registry, ESLint, Prettier, syntax, diff, and zero-cycle ratchet across
  410 files are green on `origin/main` at `07caedf8`.
- 2026-07-27 — PR #317 merged as `3258a19a` with all ten CI lanes green; the
  serialized workplan render followed on `origin/main` at `b6b56e49`. Closed
  this child and activated `refactor-tutor-stub-technical-debug-presentation`
  for the remaining deterministic `/debug technical` renderer.
