---
id: refactor-evaluation-resume-rejudge-runtime
title: Extract evaluation resume and rejudge runtimes
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-05
updated: 2026-08-05
branch: codex/refactor-evaluation-resume-rejudge-runtime
verification: The evaluationRunner compatibility facade delegates resume/checkpoint coordination and rejudge scoring/orchestration to bounded owners while frozen rows, attempt indexes, checkpoints, trace/score symmetry, hashes, judge provenance, CLI output, and error behavior remain unchanged; focused, zero-skip hermetic, lint, format, manifest, workplan, coverage-risk, and zero-cycle gates pass with no production owner above 1,200 lines.
claim_status: planned
depends_on:
  - refactor-evaluation-turn-execution
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/evaluationRunner.js
    - services/evaluationResumeRuntime.js
    - services/evaluationRejudgeRuntime.js
    - services/evaluationCheckpointStore.js
    - tests/evaluationRunner.test.js
    - tests/evaluationResumeRejudgeRuntime.test.js
    - tests/checkpointE2E.test.js
    - tests/checkpointResume.test.js
    - tests/evaluationStoreRoundtripIntegrity.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-turn-execution
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/513
tags:
  - refactoring
  - evaluation
  - resume
  - rejudge
  - provenance
  - maintainability
milestone: evaluation-infrastructure
---

Execute R4 step 3 from the canonical refactoring plan. Preserve
`services/evaluationRunner.js` as the compatibility surface while moving
resume/checkpoint coordination and rejudge scoring/orchestration into explicit
bounded runtimes.

Acceptance:

- Extract `resumeEvaluation` behind a dependency-injected runtime that retains
  attempt-aware completion, checkpoint recovery, worker scheduling, monitoring,
  progress reporting, PID ownership, and failure semantics.
- Extract multi-turn rejudgment plus `rejudgeRun` behind a bounded runtime that
  retains tutor/learner score symmetry, judge provenance, dialogue hashes,
  rubric versions, row cloning/overwrite behavior, and report shape.
- Keep each new production owner at or below 1,200 lines and preserve every
  named/default export from `evaluationRunner.js`.
- Add architectural ratchets plus frozen fixture/row parity at the moved
  boundaries; production databases and logs must remain untouched by tests.
- Use existing mock/frozen fixtures only. This structural slice authorizes no
  paid model calls and no empirical claim changes.

Log:

- 2026-08-05 — Activated from `origin/main` at `dd377147` after PR #512 merged
  R4 step 2. Baseline: `evaluationRunner.js` is 3,534 lines;
  `resumeEvaluation` spans about 466 lines and the rejudge region spans about
  946 lines. The checkpoint file store is already a 71-line owner; this slice
  moves the remaining orchestration without changing its persistence contract.
- 2026-08-05 — Reached review with `evaluationRunner.js` reduced from 3,534 to
  2,187 lines (1,347 lines, 38.1% removed). Resume coordination now lives in a
  488-line owner and rejudge orchestration in a 963-line owner; the facade
  retains the named/default exports and import-time provider-hook contract.
- 2026-08-05 — Validation is green without model calls: 191 focused runner,
  checkpoint, store-roundtrip, CLI, prompt-version, and boundary tests; the
  zero-skip hermetic root suite (7,842 tests) plus in-housed core suite (137
  tests); all five risk-coverage groups; lint; format; static-cycle zero gate;
  manifest; workplan source/tests; and diff checks. Boundary tests freeze
  missing-run and judge-selection errors, completed-generation skipping, and
  cross-judge overwrite refusal while ratcheting both new owners below 1,200
  lines.
- 2026-08-05 — Opened the reviewed slice as PR #513 against `main`; local and
  remote implementation SHAs matched at `4ba78c7f` before this PR-link
  follow-up.
- 2026-08-05 — PR #513 merged to `main` as `3b50ef95`; the generated workplan
  refresh followed at `23816179`. All required CI jobs passed, so the card is
  closed before eval-cli command decomposition begins.
